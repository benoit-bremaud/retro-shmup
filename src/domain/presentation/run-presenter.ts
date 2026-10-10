import type { Bullet } from '../game/bullet';
import type { Enemy } from '../game/enemy';
import { PlayerState } from '../game/player';
import type { PlayerSnapshot, WorldSnapshot } from '../game/run';
import type { ReadonlyActiveList } from '../game/active-list';
import { PlayerTuning, STEPS_PER_SECOND } from '../game/tuning';
import type { RenderPort } from '../ports/render-port';
import { drawHud } from './hud';
import { Palette } from './palette';
import type { PaletteColour } from './palette';

/** Game-feel switches the presenter honours (GDD §9.4); the options screen sets them later. */
export interface EffectSettings {
  blink: boolean;
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
 * Draws the run from its snapshot (ADR-0010: presentation never changes the outcome): the field,
 * then the HUD contents. Positions are interpolated with `alpha` (ADR-0002). Enemies, bullets and
 * the ship are placeholder palette rectangles until the assets brick.
 */
export class RunPresenter {
  private readonly render: RenderPort;
  private readonly effects: Readonly<EffectSettings>;

  constructor(render: RenderPort, effects: Readonly<EffectSettings>) {
    this.render = render;
    this.effects = effects;
  }

  /** Hit-stop and slow motion arrive with the game-feel effects; until then full speed. */
  timeScale(): number {
    return 1;
  }

  /** Enemies, player bullets, the ship, then enemy bullets on top; then the HUD contents. */
  draw(snapshot: WorldSnapshot, alpha: number): void {
    this.render.setRegion('field');
    for (let i = 0; i < snapshot.enemies.count; i += 1) {
      const enemy = snapshot.enemies.at(i);
      this.drawBox(enemy, alpha, enemyColour(enemy));
    }
    this.drawBullets(snapshot.playerBullets, alpha, Palette.playerShot);
    const player = snapshot.player;
    if (isShipVisible(player, this.effects)) {
      const x = lerp(player.previousPosition.x, player.position.x, alpha);
      const y = lerp(player.previousPosition.y, player.position.y, alpha);
      this.drawShip(x, y);
    }
    this.drawBullets(snapshot.enemyBullets, alpha, Palette.enemyShot);
    drawHud(this.render, snapshot);
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
