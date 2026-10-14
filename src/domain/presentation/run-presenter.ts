import type { ReadonlyActiveList } from '../game/active-list';
import { BossState } from '../game/boss';
import type { Bullet } from '../game/bullet';
import { CRUISER_TURRET } from '../game/cruiser';
import type { Enemy } from '../game/enemy';
import { PickupKind } from '../game/pickup';
import type { Pickup } from '../game/pickup';
import { GameEventKind } from '../game/events';
import type { GameEvent, RunEvents } from '../game/events';
import { PlayerState } from '../game/player';
import type { BossSnapshot, PlayerSnapshot, WorldSnapshot } from '../game/run';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../game/geometry';
import { PlayerTuning, STEPS_PER_SECOND } from '../game/tuning';
import { WeaponKind } from '../game/weapon';
import type { RenderPort } from '../ports/render-port';
import {
  BombFlash,
  BossChain,
  ExplosionTier,
  Explosions,
  HitFlashes,
  Shake,
  SlowMotion,
} from './effects';
import { drawBossBar } from './boss-hud';
import { drawHud } from './hud';
import { drawHollowSquare, drawPlusIcon, drawShipIcon } from './icons';
import type { EffectSettings } from '../options';
import { Palette } from './palette';
import type { PaletteColour } from './palette';

// Drawn sizes, not hitboxes (GDD v0.9 §3.2): enemy bullets read first, player shots stay back.
const ENEMY_SHOT_DRAWN = 6;
const ENEMY_SHOT_CORE = 2;
const SPREAD_DRAWN_HEIGHT = 6;

/** The phase index whose start breaks the Cruiser's turret off (phase 2). */
const TURRET_BREAKS_AT_PHASE = 1;

const BLINK_HALF_PERIOD_STEPS = STEPS_PER_SECOND / (PlayerTuning.blinksPerSecond * 2);

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

/** Visible for the first half of each blink, from a count that never restarts (GDD v0.5 §4.1). */
function isShipVisible(player: PlayerSnapshot, effects: Readonly<EffectSettings>): boolean {
  if (player.state === PlayerState.Dead) return false;
  if (!effects.blink || player.state === PlayerState.Vulnerable) return true;
  return Math.floor(player.protectionSteps / BLINK_HALF_PERIOD_STEPS) % 2 === 0;
}

/** The placeholder colour of a role, chosen here, never stored in archetype data (ADR-0010). */
function enemyColour(enemy: Readonly<Enemy>): PaletteColour {
  switch (enemy.archetype.id) {
    case 'popcorn':
      return Palette.popcorn;
    case 'diver':
      return Palette.diver;
    case 'gunner':
      return Palette.gunner;
    case 'carrier':
      return Palette.carrier;
    case 'heavy-ring':
    case 'heavy-fan':
      return Palette.heavy;
  }
}

/**
 * Draws one run from its snapshot (ADR-0010: presentation never changes the outcome) and owns its
 * game-feel effects. One presenter per run, built with it: no effect outlives its run. Event
 * handlers only record; effects are drawn, then aged by the frame's wall time, so an effect born
 * in this frame's steps is drawn at least once (02-sequence-fixed-step-tick).
 */
export class RunPresenter {
  private readonly render: RenderPort;
  private readonly effects: Readonly<EffectSettings>;
  private readonly flashes = new HitFlashes();
  private readonly explosions = new Explosions();
  private readonly bombFlash = new BombFlash();
  private readonly shake = new Shake();
  private readonly bossChain = new BossChain();
  private readonly slowMotion = new SlowMotion();
  /** The boss died during this frame's steps: its slow motion and chain start on the next frame. */
  private bossDiedThisFrame = false;

  constructor(render: RenderPort, effects: Readonly<EffectSettings>, events: RunEvents) {
    this.render = render;
    this.effects = effects;
    events.subscribe(GameEventKind.EnemyHit, this.onEnemyHit);
    events.subscribe(GameEventKind.EnemyDestroyed, this.onEnemyDestroyed);
    events.subscribe(GameEventKind.BombUsed, this.onBombUsed);
    events.subscribe(GameEventKind.PlayerDied, this.onPlayerDied);
    events.subscribe(GameEventKind.BossPhaseChanged, this.onBossPhaseChanged);
    events.subscribe(GameEventKind.BossDestroyed, this.onBossDestroyed);
  }

  /**
   * Sets the field's camera offset for this frame (ADR-0014: field draws only); the scene machine
   * calls it before the starfield, so the whole field shakes and the HUD never does.
   */
  applyShake(): void {
    this.shake.apply(this.render);
  }

  /** 0.5 during the slow motion after the boss's death, else 1 (always 1 with the switch off). */
  timeScale(): number {
    return this.effects.slowMotion ? this.slowMotion.scale() : 1;
  }

  /**
   * The boss, enemies, explosions, pickups, player bullets, the ship and its shield ring, then enemy
   * bullets on top, then the bomb flash over the field, then the boss's HP bar and seconds; then the
   * HUD contents; then the effects
   * age by `wallDtMs` (0 in a frozen frame).
   */
  draw(snapshot: WorldSnapshot, alpha: number, wallDtMs: number): void {
    this.render.setRegion('field');
    this.drawBoss(snapshot.boss, alpha);
    for (let i = 0; i < snapshot.enemies.count; i += 1) {
      const enemy = snapshot.enemies.at(i);
      const flashing = this.effects.hitFlash && this.flashes.isFlashing(enemy.serial);
      this.drawBox(enemy, alpha, flashing ? Palette.hitFlash : enemyColour(enemy));
    }
    this.explosions.draw(this.render);
    this.drawPickups(snapshot.pickups, alpha);
    this.drawPlayerShots(snapshot.playerBullets, alpha);
    const player = snapshot.player;
    if (isShipVisible(player, this.effects)) {
      const x = lerp(player.previousPosition.x, player.position.x, alpha);
      const y = lerp(player.previousPosition.y, player.position.y, alpha);
      this.drawShip(x, y);
      if (snapshot.shield) this.drawShieldRing(x, y);
    }
    this.drawEnemyBullets(snapshot.enemyBullets, alpha);
    this.bombFlash.draw(this.render, FIELD_WIDTH, FIELD_HEIGHT);
    drawBossBar(this.render, snapshot.boss);
    drawHud(this.render, snapshot);
    this.flashes.advance(wallDtMs);
    this.explosions.advance(wallDtMs);
    // After the explosions age, so a chained burst is first drawn at age 0. The frame that ran the
    // killing step counts for neither: a long frame would otherwise eat the slow motion.
    const sinceDeathMs = this.bossDiedThisFrame ? 0 : wallDtMs;
    this.bossDiedThisFrame = false;
    this.bossChain.advance(sinceDeathMs, this.explosions);
    this.slowMotion.advance(sinceDeathMs);
    this.bombFlash.advance(wallDtMs);
    this.shake.advance(wallDtMs);
  }

  /**
   * The boss as plain grey boxes (F-2a): the 112 × 48 body and, until phase 2 breaks it off, the
   * forward turret. Nothing while it is idle or warning, off the field; the HP bar, the WARNING
   * banner and the debris are F-2b and F-2c.
   */
  private drawBoss(boss: BossSnapshot, alpha: number): void {
    if (boss.state === BossState.Idle || boss.state === BossState.Warning) return;
    const x = lerp(boss.previousPosition.x, boss.position.x, alpha);
    const y = lerp(boss.previousPosition.y, boss.position.y, alpha);
    const flashing = this.effects.hitFlash && this.flashes.isFlashing(boss.serial);
    const r = this.render;
    r.drawRect(
      x - boss.width / 2,
      y - boss.height / 2,
      boss.width,
      boss.height,
      flashing ? Palette.hitFlash : Palette.boss,
    );
    if (boss.phase > 0 || flashing) return;
    r.drawRect(
      x + CRUISER_TURRET.offsetX - CRUISER_TURRET.width / 2,
      y + CRUISER_TURRET.offsetY - CRUISER_TURRET.height / 2,
      CRUISER_TURRET.width,
      CRUISER_TURRET.height,
      Palette.bossTurret,
    );
  }

  // Handlers only record (ADR-0010): copied out of the reused event, never kept.
  private readonly onEnemyHit = (event: Readonly<GameEvent>): void => {
    if (this.effects.hitFlash) this.flashes.record(event.subject);
  };

  private readonly onBombUsed = (): void => {
    if (this.effects.bombFlash) this.bombFlash.trigger();
    if (this.effects.shake) this.shake.trigger();
  };

  private readonly onPlayerDied = (event: Readonly<GameEvent>): void => {
    if (this.effects.explosions) {
      this.explosions.record(event.position.x, event.position.y, ExplosionTier.Medium);
    }
  };

  // Debris where the broken part was (GDD v0.10 §9.4). The presenter only knows the Cruiser's
  // turret, the one broken part of the vertical slice; it breaks off when phase 2 (index 1) starts.
  // A later boss with more phases and parts hands its broken part to the snapshot.
  private readonly onBossPhaseChanged = (event: Readonly<GameEvent>): void => {
    if (!this.effects.explosions || event.detail !== TURRET_BREAKS_AT_PHASE) return;
    const x = event.position.x + CRUISER_TURRET.offsetX;
    const y = event.position.y + CRUISER_TURRET.offsetY;
    this.explosions.record(x, y, ExplosionTier.Debris);
  };

  private readonly onBossDestroyed = (event: Readonly<GameEvent>): void => {
    this.bossDiedThisFrame = true;
    if (this.effects.explosions) {
      this.bossChain.trigger(event.position.x, event.position.y, this.explosions);
    }
    if (this.effects.slowMotion) this.slowMotion.trigger();
  };

  private readonly onEnemyDestroyed = (event: Readonly<GameEvent>): void => {
    if (this.effects.explosions) {
      this.explosions.record(event.position.x, event.position.y, event.detail);
    }
  };

  /**
   * Placeholder pickups, 16 × 16 (meta/05-state-scenes, player-kit additions): the P capsules in
   * the pickup's colour carry the weapon badge's mark — three dots for P-red, a bar for P-blue — so
   * the two never differ by colour only (GDD §9.7); Shield, Bomb and 1-UP use the `icons.ts` shapes
   * (hollow square, plus, ship).
   */
  private drawPickups(pickups: ReadonlyActiveList<Pickup>, alpha: number): void {
    for (let i = 0; i < pickups.count; i += 1) {
      const pickup = pickups.at(i);
      const x = lerp(pickup.previousPosition.x, pickup.position.x, alpha);
      const y = lerp(pickup.previousPosition.y, pickup.position.y, alpha);
      this.drawPickup(pickup.kind, x, y);
    }
  }

  // The 16 × 16 placeholder of a pickup centred on (x, y): each kind its own shape.
  private drawPickup(kind: PickupKind, x: number, y: number): void {
    const r = this.render;
    const left = x - 8;
    const top = y - 8;
    switch (kind) {
      case PickupKind.PRed:
        r.drawRect(left, top, 16, 16, Palette.pickupRed);
        for (let dot = -1; dot <= 1; dot += 1) {
          r.drawRect(x + dot * 4 - 1, y - 1, 2, 2, Palette.pickupMark);
        }
        return;
      case PickupKind.PBlue:
        r.drawRect(left, top, 16, 16, Palette.pickupBlue);
        r.drawRect(x - 1, y - 4, 2, 8, Palette.pickupMark);
        return;
      case PickupKind.Shield:
        drawHollowSquare(r, left, top, 16, Palette.shieldPickup);
        return;
      case PickupKind.Bomb:
        drawPlusIcon(r, left, top, 16, Palette.bombPickup);
        return;
      case PickupKind.OneUp:
        drawShipIcon(r, left, top, 16, Palette.oneUpPickup);
        return;
      default: {
        // A new pickup kind fails to compile here until it is drawn.
        const unknown: never = kind;
        return unknown;
      }
    }
  }

  // Each shot in its weapon's colour, read from the bullet, never from its size; a Spread bullet
  // is drawn shorter than its 2 × 8 hitbox (GDD v0.9 §3.2).
  private drawPlayerShots(bullets: ReadonlyActiveList<Bullet>, alpha: number): void {
    for (let i = 0; i < bullets.count; i += 1) {
      const bullet = bullets.at(i);
      if (bullet.weapon === WeaponKind.Laser) {
        this.drawBox(bullet, alpha, Palette.laserShot);
        continue;
      }
      const x = lerp(bullet.previousPosition.x, bullet.position.x, alpha);
      const y = lerp(bullet.previousPosition.y, bullet.position.y, alpha);
      const h = SPREAD_DRAWN_HEIGHT;
      this.render.drawRect(x - bullet.width / 2, y - h / 2, bullet.width, h, Palette.playerShot);
    }
  }

  // Enemy bullets drawn larger than their 4 × 4 hitbox, with a white core (GDD v0.9 §3.2).
  private drawEnemyBullets(bullets: ReadonlyActiveList<Bullet>, alpha: number): void {
    const r = this.render;
    for (let i = 0; i < bullets.count; i += 1) {
      const bullet = bullets.at(i);
      const x = lerp(bullet.previousPosition.x, bullet.position.x, alpha);
      const y = lerp(bullet.previousPosition.y, bullet.position.y, alpha);
      r.drawRect(
        x - ENEMY_SHOT_DRAWN / 2,
        y - ENEMY_SHOT_DRAWN / 2,
        ENEMY_SHOT_DRAWN,
        ENEMY_SHOT_DRAWN,
        Palette.enemyShot,
      );
      r.drawRect(
        x - ENEMY_SHOT_CORE / 2,
        y - ENEMY_SHOT_CORE / 2,
        ENEMY_SHOT_CORE,
        ENEMY_SHOT_CORE,
        Palette.enemyShotCore,
      );
    }
  }

  // A box centred on its interpolated position.
  private drawBox(box: Readonly<Bullet> | Readonly<Enemy>, alpha: number, colour: string): void {
    const x = lerp(box.previousPosition.x, box.position.x, alpha);
    const y = lerp(box.previousPosition.y, box.position.y, alpha);
    this.render.drawRect(x - box.width / 2, y - box.height / 2, box.width, box.height, colour);
  }

  // The shield ring: a 36 × 36 outline of four 2 px rectangles around the ship (GDD v0.8 §4.4).
  private drawShieldRing(x: number, y: number): void {
    const r = this.render;
    const half = 18;
    const t = 2;
    r.drawRect(x - half, y - half, 2 * half, t, Palette.shieldRing);
    r.drawRect(x - half, y + half - t, 2 * half, t, Palette.shieldRing);
    r.drawRect(x - half, y - half + t, t, 2 * half - 2 * t, Palette.shieldRing);
    r.drawRect(x + half - t, y - half + t, t, 2 * half - 2 * t, Palette.shieldRing);
  }

  // Placeholder silhouette inside the 32 × 32 sprite box; the hull covers the centre.
  private drawShip(x: number, y: number): void {
    const r = this.render;
    r.drawRect(x - 16, y + 2, 32, 8, Palette.shipWing);
    r.drawRect(x - 4, y - 14, 8, 28, Palette.shipHull);
    // The cockpit is the hitbox, exactly: the bright square shows where a bullet counts (GDD §4.1).
    const core = PlayerTuning.hitboxSize;
    r.drawRect(x - core / 2, y - core / 2, core, core, Palette.shipCockpit);
  }
}
