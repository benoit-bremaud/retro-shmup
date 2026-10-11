import type { ReadonlyActiveList } from '../game/active-list';
import type { Bullet } from '../game/bullet';
import type { Enemy } from '../game/enemy';
import { PickupKind } from '../game/pickup';
import type { Pickup } from '../game/pickup';
import { GameEventKind } from '../game/events';
import type { GameEvent, RunEvents } from '../game/events';
import { PlayerState } from '../game/player';
import type { PlayerSnapshot, WorldSnapshot } from '../game/run';
import { PlayerTuning, STEPS_PER_SECOND } from '../game/tuning';
import { WeaponKind } from '../game/weapon';
import type { RenderPort } from '../ports/render-port';
import { Explosions, HitFlashes } from './effects';
import { drawHud } from './hud';
import { Palette } from './palette';
import type { PaletteColour } from './palette';

/** Game-feel switches the presenter honours (GDD §9.4); the options screen sets them later. */
export interface EffectSettings {
  blink: boolean;
  hitFlash: boolean;
  explosions: boolean;
}

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

  constructor(render: RenderPort, effects: Readonly<EffectSettings>, events: RunEvents) {
    this.render = render;
    this.effects = effects;
    events.subscribe(GameEventKind.EnemyHit, this.onEnemyHit);
    events.subscribe(GameEventKind.EnemyDestroyed, this.onEnemyDestroyed);
  }

  /** Hit-stop and slow motion arrive with the later game-feel effects; until then full speed. */
  timeScale(): number {
    return 1;
  }

  /**
   * Enemies, explosions, player bullets, the ship, then enemy bullets on top; then the HUD
   * contents; then the effects age by `wallDtMs` (0 in a frozen frame).
   */
  draw(snapshot: WorldSnapshot, alpha: number, wallDtMs: number): void {
    this.render.setRegion('field');
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
    }
    this.drawBullets(snapshot.enemyBullets, alpha, Palette.enemyShot);
    drawHud(this.render, snapshot);
    this.flashes.advance(wallDtMs);
    this.explosions.advance(wallDtMs);
  }

  // Handlers only record (ADR-0010): copied out of the reused event, never kept.
  private readonly onEnemyHit = (event: Readonly<GameEvent>): void => {
    if (this.effects.hitFlash) this.flashes.record(event.subject);
  };

  private readonly onEnemyDestroyed = (event: Readonly<GameEvent>): void => {
    if (this.effects.explosions) {
      this.explosions.record(event.position.x, event.position.y, event.detail);
    }
  };

  /**
   * Placeholder P capsules (meta/05-state-scenes, player-kit additions): a 16 × 16 capsule in the
   * pickup's colour carrying the weapon badge's mark — three dots for P-red, a bar for P-blue — so
   * the two never differ by colour only (GDD §9.7).
   */
  private drawPickups(pickups: ReadonlyActiveList<Pickup>, alpha: number): void {
    const r = this.render;
    for (let i = 0; i < pickups.count; i += 1) {
      const pickup = pickups.at(i);
      const x = lerp(pickup.previousPosition.x, pickup.position.x, alpha);
      const y = lerp(pickup.previousPosition.y, pickup.position.y, alpha);
      const red = pickup.kind === PickupKind.PRed;
      r.drawRect(x - 8, y - 8, 16, 16, red ? Palette.pickupRed : Palette.pickupBlue);
      if (red) {
        for (let dot = -1; dot <= 1; dot += 1) {
          r.drawRect(x + dot * 4 - 1, y - 1, 2, 2, Palette.pickupMark);
        }
      } else {
        r.drawRect(x - 1, y - 4, 2, 8, Palette.pickupMark);
      }
    }
  }

  // Each shot in its weapon's colour, read from the bullet, never from its size.
  private drawPlayerShots(bullets: ReadonlyActiveList<Bullet>, alpha: number): void {
    for (let i = 0; i < bullets.count; i += 1) {
      const bullet = bullets.at(i);
      const colour = bullet.weapon === WeaponKind.Laser ? Palette.laserShot : Palette.playerShot;
      this.drawBox(bullet, alpha, colour);
    }
  }

  private drawBullets(bullets: ReadonlyActiveList<Bullet>, alpha: number, colour: string): void {
    for (let i = 0; i < bullets.count; i += 1) this.drawBox(bullets.at(i), alpha, colour);
  }

  // A box centred on its interpolated position.
  private drawBox(box: Readonly<Bullet> | Readonly<Enemy>, alpha: number, colour: string): void {
    const x = lerp(box.previousPosition.x, box.position.x, alpha);
    const y = lerp(box.previousPosition.y, box.position.y, alpha);
    this.render.drawRect(x - box.width / 2, y - box.height / 2, box.width, box.height, colour);
  }

  // Placeholder silhouette inside the 32 × 32 sprite box; the hull covers the centre.
  private drawShip(x: number, y: number): void {
    const r = this.render;
    r.drawRect(x - 16, y + 2, 32, 8, Palette.shipWing);
    r.drawRect(x - 4, y - 14, 8, 28, Palette.shipHull);
    r.drawRect(x - 2, y - 8, 4, 6, Palette.shipCockpit);
  }
}
