import type { Random } from '../ports/random';
import { applyDamage } from './body';
import { BossAdvance } from './boss';
import type { BossDefinition } from './boss';
import type { HitRules } from './collision';
import { NORMAL } from './difficulty';
import type { Enemy } from './enemy';
import { createGameEvent, GameEventKind } from './events';
import type { EventBus, GameEvent } from './events';
import type { Formation } from './formation';
import type { EnemySpawner } from './level-director';
import type { LevelScript, ScriptEvent } from './level-script';
import { PickupKind, PickupMotion } from './pickup';
import type { Pickup } from './pickup';
import { KitTuning } from './tuning';
import { WeaponKind } from './weapon';
import type { World } from './world';

const NONE = -1;

/**
 * The rules a run applies to what happens in the world: kills, drops, rewards, the boss, the
 * bomb, the ship's death. Split from `Run` (ADR-0023 decision 7) so the frame order stays in one
 * small class and the rules, which grow with every boss and pickup, in another. It realizes the
 * two seams the collision resolver and the level director call, so neither knows `Run`.
 * It owns no state of the run beyond the preallocated events: the world, the bus and the seeded
 * `Random` are the run's, lent for the rules to act on.
 */
export class RunRules implements HitRules, EnemySpawner {
  private readonly world: World;
  private readonly bus: EventBus;
  private readonly random: Random;
  private readonly script: LevelScript;
  private readonly enemyHitEvent = createGameEvent(GameEventKind.EnemyHit);
  private readonly enemyDestroyedEvent = createGameEvent(GameEventKind.EnemyDestroyed);
  private readonly playerDiedEvent = createGameEvent(GameEventKind.PlayerDied);
  private readonly pickupSpawnedEvent = createGameEvent(GameEventKind.PickupSpawned);
  private readonly pickupCollectedEvent = createGameEvent(GameEventKind.PickupCollected);
  private readonly formationClearedEvent = createGameEvent(GameEventKind.FormationCleared);
  private readonly playerHitEvent = createGameEvent(GameEventKind.PlayerHit);
  private readonly bombUsedEvent = createGameEvent(GameEventKind.BombUsed);
  private readonly bossWarningEvent = createGameEvent(GameEventKind.BossWarning);
  private readonly bossPhaseChangedEvent = createGameEvent(GameEventKind.BossPhaseChanged);
  private readonly bossDestroyedEvent = createGameEvent(GameEventKind.BossDestroyed);
  private readonly bossFledEvent = createGameEvent(GameEventKind.BossFled);
  private readonly levelClearedEvent = createGameEvent(GameEventKind.LevelCleared);

  /**
   * `random` serves drops only (ADR-0010 decision 1); `script` gives the formation reward its
   * colour.
   */
  constructor(world: World, bus: EventBus, random: Random, script: LevelScript) {
    this.world = world;
    this.bus = bus;
    this.random = random;
    this.script = script;
  }

  /** `HitRules`: a shot touched a live enemy (white flash). */
  enemyHit(enemy: Enemy): void {
    this.publishAt(this.enemyHitEvent, enemy.position.x, enemy.position.y, 0, 0, enemy.serial);
  }

  /**
   * `HitRules`: marks the enemy; it is released at step 6, so the event carries all it needs.
   * Then its cargo or its drop, and its formation's P (02-sequence-enemy-destroyed):
   * `PICKUP_SPAWNED` follows, once per pickup that exists.
   */
  destroyEnemy(enemy: Enemy): void {
    enemy.spent = true;
    const x = enemy.position.x;
    const y = enemy.position.y;
    this.publishAt(
      this.enemyDestroyedEvent,
      x,
      y,
      enemy.archetype.stats.score,
      enemy.archetype.stats.tier,
      enemy.serial,
    );
    const dropped = enemy.cargo ?? this.rollDrop(enemy);
    const droppedSpawned = dropped !== NONE && this.world.spawnPickup(dropped, x, y);
    enemy.formation?.memberDestroyed(x, y);
    const rewardSpawned = this.rewardIfCleared(enemy.formation);
    if (droppedSpawned) this.publishAt(this.pickupSpawnedEvent, x, y, 0, dropped);
    if (rewardSpawned) this.publishReward(enemy.formation);
  }

  /** `EnemySpawner`, step 1: the world spawns; a refused member may complete its formation. */
  startFormation(total: number): Formation | undefined {
    return this.world.startFormation(total);
  }

  /**
   * `EnemySpawner`, step 1, at the script's `warningAt` (02-sequence-boss-fight): the boss starts
   * in `WARNING` with a fresh serial and the run says so.
   */
  startBoss(definition: BossDefinition): void {
    const boss = this.world.boss;
    boss.start(definition, this.world.takeSerial());
    this.publishAt(this.bossWarningEvent, boss.position.x, boss.position.y, 0, 0, boss.serial);
  }

  /**
   * `HitRules`: a shot or the bomb hit the fighting boss (02-sequence-boss-fight). `ENEMY_HIT`
   * carries its serial. At 0 HP the enemy bullets are cancelled and the boss is destroyed;
   * otherwise one `BOSS_PHASE_CHANGED` follows per threshold crossed, `detail` = the new phase.
   */
  damageBoss(amount: number): void {
    const boss = this.world.boss;
    const destroyed = applyDamage(boss, amount);
    this.publishAt(this.enemyHitEvent, boss.position.x, boss.position.y, 0, 0, boss.serial);
    if (destroyed) {
      this.world.cancelEnemyBullets();
      boss.destroy();
      this.publishAt(
        this.bossDestroyedEvent,
        boss.position.x,
        boss.position.y,
        boss.secondsLeft(),
        0,
        boss.serial,
      );
      return;
    }
    while (boss.advancePhase(this.world)) {
      const detail = boss.phaseIndex;
      this.publishAt(
        this.bossPhaseChangedEvent,
        boss.position.x,
        boss.position.y,
        0,
        detail,
        boss.serial,
      );
    }
  }

  /**
   * Step 7: the boss's state timers advance. An expired timer cancels the enemy bullets and
   * publishes the escape. Returns whether the destroyed or fleeing sequence just ended, which
   * arms the level end the run owns.
   */
  advanceBoss(): boolean {
    const boss = this.world.boss;
    const advance = boss.advance(this.world);
    if (advance === BossAdvance.Fled) {
      this.world.cancelEnemyBullets();
      this.publishAt(this.bossFledEvent, boss.position.x, boss.position.y, 0, 0, boss.serial);
    }
    return advance === BossAdvance.Ended;
  }

  /** Step 8: `LEVEL_CLEARED` carries the bombs the ship has left; the outcome stays the run's. */
  levelCleared(): void {
    const ship = this.world.player;
    this.publishAt(this.levelClearedEvent, ship.position.x, ship.position.y, ship.bombs, 0);
  }

  /** `EnemySpawner`: a refused member still counts toward completing its formation. */
  spawnEnemy(event: Readonly<ScriptEvent>, formation: Formation | undefined): boolean {
    if (this.world.spawnEnemy(event, formation)) return true;
    if (formation === undefined) return false;
    formation.refused += 1;
    if (this.rewardIfCleared(formation)) this.publishReward(formation);
    return false;
  }

  /** `HitRules`: the ship caught the pickup; the cap bonus, if any, is scored flat. */
  pickupCollected(pickup: Pickup): void {
    const bonus = this.world.player.collect(pickup.kind);
    this.publishAt(
      this.pickupCollectedEvent,
      pickup.position.x,
      pickup.position.y,
      bonus,
      pickup.kind,
    );
  }

  /**
   * `HitRules`: the ship died this step (02-sequence-player-hit). The death effects apply at once
   * — the power drops a level and the bombs reset — and a lost level is released as a P of the
   * current weapon's colour, spawned before `PLAYER_DIED` is published, last life included.
   */
  playerDied(): void {
    const player = this.world.player;
    const x = player.position.x;
    const y = player.position.y;
    if (player.applyDeathPenalty()) {
      const colour = player.weaponKind === WeaponKind.Laser ? PickupKind.PBlue : PickupKind.PRed;
      if (this.world.spawnPickup(colour, x, y, PickupMotion.Release)) {
        this.publishAt(this.pickupSpawnedEvent, x, y, 0, colour);
      }
    }
    this.publishAt(this.playerDiedEvent, x, y, 0, 0);
  }

  /** `HitRules`: the shield charge took the hit (GDD v0.8 §4.4). */
  shieldBroken(): void {
    const ship = this.world.player.position;
    this.publishAt(this.playerHitEvent, ship.x, ship.y, 0, 0);
  }

  /**
   * The bomb (02-sequence-bomb, GDD v0.8 §4.5): `BOMB_USED` first, then every enemy bullet is
   * cancelled and every enemy on the field takes 30 level-1 shots once, through the normal kill
   * path. Enemies still outside the field are untouched.
   */
  detonate(): void {
    const ship = this.world.player.position;
    this.publishAt(this.bombUsedEvent, ship.x, ship.y, 0, 0);
    this.world.cancelEnemyBullets();
    const enemies = this.world.enemies;
    for (let i = 0; i < enemies.count; i += 1) {
      const enemy = enemies.at(i);
      if (enemy.spent || !this.world.isOnField(enemy)) continue;
      const destroyed = applyDamage(enemy, KitTuning.bombDamage);
      this.enemyHit(enemy);
      if (destroyed) this.destroyEnemy(enemy);
    }
    // The boss takes the bomb only while it fights; in WARNING and ENTERING it is untouched.
    if (this.world.boss.isTargetable()) this.damageBoss(KitTuning.bombDamage);
  }

  /**
   * The formation completion check (class diagram), run whenever a member is destroyed or
   * refused: the first time every member that appeared is destroyed, the P of the dominant colour
   * spawns at the last one and `FORMATION_CLEARED` is published. Returns whether the P exists.
   */
  private rewardIfCleared(formation: Formation | undefined): boolean {
    if (formation?.isCleared() !== true) return false;
    formation.rewarded = true;
    this.publishAt(this.formationClearedEvent, formation.lastX, formation.lastY, 0, 0);
    return this.world.spawnPickup(this.script.dominantColour, formation.lastX, formation.lastY);
  }

  private publishReward(formation: Formation | undefined): void {
    if (formation === undefined) return;
    const colour = this.script.dominantColour;
    this.publishAt(this.pickupSpawnedEvent, formation.lastX, formation.lastY, 0, colour);
  }

  /**
   * One draw per killed enemy whose table can drop (ADR-0019): a drop when
   * `r < rate × dropRateScale`, and the same `r` picks the kind; `NONE` otherwise.
   */
  private rollDrop(enemy: Enemy): PickupKind | typeof NONE {
    const drops = enemy.archetype.drops;
    if (drops.rate <= 0 || drops.kinds.length === 0) return NONE;
    const rate = drops.rate * NORMAL.dropRateScale;
    const r = this.random.next();
    if (r >= rate) return NONE;
    return drops.kinds[Math.floor((r / rate) * drops.kinds.length)] ?? NONE;
  }

  private publishAt(
    event: GameEvent,
    x: number,
    y: number,
    value: number,
    detail: number,
    subject = 0,
  ): void {
    event.position.x = x;
    event.position.y = y;
    event.subject = subject;
    event.value = value;
    event.detail = detail;
    this.bus.publish(event);
  }
}
