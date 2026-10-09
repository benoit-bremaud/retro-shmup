import { PlayerState } from '../game/player';
import type { PlayerSnapshot, WorldSnapshot } from '../game/run';
import { PlayerTuning, STEPS_PER_SECOND } from '../game/tuning';
import type { RenderPort } from '../ports/render-port';
import { Palette } from './palette';

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
  if (!effects.blink || player.state === PlayerState.Vulnerable) return true;
  return Math.floor(player.protectionSteps / BLINK_HALF_PERIOD_STEPS) % 2 === 0;
}

/**
 * Draws the run in the play field from its snapshot (ADR-0010: presentation never changes the
 * outcome). Positions are interpolated with `alpha` (ADR-0002). The ship is a placeholder made of
 * palette rectangles until the assets brick.
 */
export class RunPresenter {
  private readonly render: RenderPort;
  private readonly effects: Readonly<EffectSettings>;

  constructor(render: RenderPort, effects: Readonly<EffectSettings>) {
    this.render = render;
    this.effects = effects;
  }

  /** Hit-stop and slow motion arrive with enemies; until then the run runs at full speed. */
  timeScale(): number {
    return 1;
  }

  /** Draws the bullets and the ship in the field region, which it selects. */
  draw(snapshot: WorldSnapshot, alpha: number): void {
    this.render.setRegion('field');
    for (let i = 0; i < snapshot.playerBulletCount; i += 1) {
      const bullet = snapshot.playerBullets[i];
      if (bullet === undefined) continue;
      const x = lerp(bullet.previousPosition.x, bullet.position.x, alpha);
      const y = lerp(bullet.previousPosition.y, bullet.position.y, alpha);
      this.render.drawRect(
        x - bullet.width / 2,
        y - bullet.height / 2,
        bullet.width,
        bullet.height,
        Palette.playerShot,
      );
    }
    const player = snapshot.player;
    if (!isShipVisible(player, this.effects)) return;
    const x = lerp(player.previousPosition.x, player.position.x, alpha);
    const y = lerp(player.previousPosition.y, player.position.y, alpha);
    this.drawShip(x, y);
  }

  // Placeholder silhouette inside the 32 × 32 sprite box; the hull covers the centre.
  private drawShip(x: number, y: number): void {
    const r = this.render;
    r.drawRect(x - 16, y + 2, 32, 8, Palette.shipWing);
    r.drawRect(x - 4, y - 14, 8, 28, Palette.shipHull);
    r.drawRect(x - 2, y - 8, 4, 6, Palette.shipCockpit);
  }
}
