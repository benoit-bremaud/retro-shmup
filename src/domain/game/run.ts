import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { Random } from '../ports/random';
import { mixSeed, SeededRandom } from '../random/seeded-random';
import type { ReadonlyActiveList } from './active-list';
import type { Bullet } from './bullet';
import { applyDamage } from './body';
import { CollisionResolver } from './collision';
import type { HitRules } from './collision';
import { NORMAL } from './difficulty';
import type { Enemy } from './enemy';
import { createGameEvent, EventBus, GameEventKind } from './events';
import type { GameEvent, RunEvents } from './events';
import type { Formation } from './formation';
import type { Vec2 } from './geometry';
import { LevelDirector } from './level-director';
import type { EnemySpawner } from './level-director';
import { LEVEL_1 } from './level-script';
import type { LevelScript, ScriptEvent } from './level-script';
import { PickupKind, PickupMotion } from './pickup';
import type { Pickup } from './pickup';
import type { PlayerState } from './player';
import { ScoreKeeper } from './score-keeper';
import { KitTuning } from './tuning';
import { WeaponKind } from './weapon';
import { World } from './world';

/**
 * How a run is built (class diagram, ADR-0019). The composition root draws `seed`; tests give a
 * short script, a fixed seed, or a scripted `Random` through `createRandom`, called once per level.
 */
export interface RunConfig {
  readonly script?: LevelScript;
  readonly seed?: number;
  readonly createRandom?: (levelSeed: number) => Random;
}

function seededRandom(levelSeed: number): Random {
  return new SeededRandom(levelSeed);
}

const NONE = -1;

/** How a run stands after a step (class diagram); levels end with the level brick. */
export const RunOutcome = {
  Playing: 'PLAYING',
  GameOver: 'GAME_OVER',
} as const;
export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome];

/** The ship as the presenter sees it. */
export interface PlayerSnapshot {
  readonly position: Readonly<Vec2>;
  readonly previousPosition: Readonly<Vec2>;
  readonly state: PlayerState;
  /** Steps since the protection began: the blink phase (05-state-player). */
  readonly protectionSteps: number;
}

/**
 * The read-only view the presenter draws from (`RunView.snapshot()`), returned without allocating:
 * it reads the live objects of the run. HUD values are getters (class diagram notes, HUD data).
 */
export interface WorldSnapshot {
  readonly player: PlayerSnapshot;
  readonly playerBullets: ReadonlyActiveList<Bullet>;
  readonly enemyBullets: ReadonlyActiveList<Bullet>;
  readonly enemies: ReadonlyActiveList<Enemy>;
  readonly pickups: ReadonlyActiveList<Pickup>;
  readonly weaponKind: WeaponKind;
  /** The power level, 1 to 5 (the HUD pips). */
  readonly power: number;
  /** Bombs in stock, 0 to 5. */
  readonly bombs: number;
  /** A shield charge is held. */
  readonly shield: boolean;
  /** Lives left, the ship in play included; the HUD shows the reserve, `lives − 1`. */
  readonly lives: number;
  readonly score: number;
  readonly multiplier: number;
  /** The chain bar, 0 to 1. */
  readonly chainRatio: number;
}

/** What the scene machine may do with a run: step it and read it (class diagram, view A). */
export interface Simulation {
  step(dt: number, frame: Readonly<IntentFrame>): void;
}

/** What the presenter and the scene machine read of a run, never write (class diagram, view A). */
export interface RunView {
  outcome(): RunOutcome;
  snapshot(): WorldSnapshot;
  /** Subscribe-only: listeners can never publish (ADR-0010). */
  events(): RunEvents;
}

/**
 * The simulation of one run (class diagram: `Simulation`, `RunView`, `HitRules`). `step` follows
 * the fixed order of the class diagram.
 */
export class Run implements Simulation, RunView, HitRules, EnemySpawner {
  private readonly world = new World();
  private readonly director: LevelDirector;
  private readonly bus = new EventBus();
  // Built right after the bus, so it is subscribed first (ADR-0010 wording note).
  private readonly scoreKeeper = new ScoreKeeper(this.bus);
  private readonly enemyHitEvent = createGameEvent(GameEventKind.EnemyHit);
  private readonly enemyDestroyedEvent = createGameEvent(GameEventKind.EnemyDestroyed);
  private readonly playerDiedEvent = createGameEvent(GameEventKind.PlayerDied);
  private readonly pickupSpawnedEvent = createGameEvent(GameEventKind.PickupSpawned);
  private readonly pickupCollectedEvent = createGameEvent(GameEventKind.PickupCollected);
  private readonly formationClearedEvent = createGameEvent(GameEventKind.FormationCleared);
  private readonly playerHitEvent = createGameEvent(GameEventKind.PlayerHit);
  private readonly bombUsedEvent = createGameEvent(GameEventKind.BombUsed);
  private currentOutcome: RunOutcome = RunOutcome.Playing;
  private readonly snapshotView: WorldSnapshot = createSnapshot(this.world, this.scoreKeeper);
  private readonly script: LevelScript;
  /** Drops only (ADR-0010 decision 1); level 1 is seeded with mixSeed(seed, 0) (ADR-0019). */
  private readonly random: Random;

  constructor(config: RunConfig = {}) {
    this.script = config.script ?? LEVEL_1;
    this.director = new LevelDirector(this.script);
    this.random = (config.createRandom ?? seededRandom)(mixSeed(config.seed ?? 0, 0));
  }

  /**
   * One fixed step; `dt` is in seconds (ADR-0014). After `GAME_OVER` the run plays on without the
   * ship, as on an arcade cabinet (GDD v0.6 §4.4): the ship stays out and the score never moves.
   */
  step(dt: number, frame: Readonly<IntentFrame>): void {
    // (1) the level script spawns what is due, through the run (refusals settle formations).
    this.director.tick(this);
    // (2) the player moves and its weapon fires.
    this.world.player.update(frame, dt, this.world);
    // (3) a bomb pressed in control goes off, before this step's collisions.
    if ((frame.pressed & Button.Bomb) !== 0 && this.world.player.useBomb()) this.detonate();
    // (4) enemies move and attack, then every bullet and every pickup moves.
    this.world.moveEnemies(dt);
    this.world.moveBullets(dt);
    this.world.movePickups();
    // (5) collisions only mark; (6) the single release point.
    CollisionResolver.resolve(this.world, this);
    this.world.sweep();
    // (7) timers advance: the chain, then the ship.
    this.scoreKeeper.tick();
    this.world.player.advanceTimers();
    // (8) the outcome: Game over once the last death sequence has ended. The ship's last
    // bullets are spent then, so nothing scores while the run plays on.
    if (this.currentOutcome === RunOutcome.Playing && this.world.player.isOut) {
      this.currentOutcome = RunOutcome.GameOver;
      this.world.spendPlayerBullets();
    }
  }

  outcome(): RunOutcome {
    return this.currentOutcome;
  }

  snapshot(): WorldSnapshot {
    return this.snapshotView;
  }

  events(): RunEvents {
    return this.bus;
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

  spawnEnemy(event: Readonly<ScriptEvent>, formation: Formation | undefined): boolean {
    if (this.world.spawnEnemy(event, formation)) return true;
    if (formation === undefined) return false;
    formation.refused += 1;
    if (this.rewardIfCleared(formation)) this.publishReward(formation);
    return false;
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
  private detonate(): void {
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
  }
}

function createSnapshot(world: World, scoreKeeper: ScoreKeeper): WorldSnapshot {
  return {
    player: world.player,
    playerBullets: world.playerBullets,
    enemyBullets: world.enemyBullets,
    enemies: world.enemies,
    pickups: world.pickups,
    get weaponKind(): WeaponKind {
      return world.player.weaponKind;
    },
    get power(): number {
      return world.player.power;
    },
    get bombs(): number {
      return world.player.bombs;
    },
    get shield(): boolean {
      return world.player.shield;
    },
    get lives(): number {
      return world.player.lives;
    },
    get score(): number {
      return scoreKeeper.score;
    },
    get multiplier(): number {
      return scoreKeeper.multiplier;
    },
    get chainRatio(): number {
      return scoreKeeper.chainRatio;
    },
  };
}
