import type { WorldSnapshot } from '../game/run';
import type { RenderPort } from '../ports/render-port';
import { HUD_LAYOUT } from './hud-layout';
import { Palette } from './palette';

/**
 * Draws the HUD contents in the left band (GDD §9.2): the reserve lives as small icons, the ship in
 * play not counted. Score, multiplier and chain bar join with scoring. Allocates nothing.
 */
export function drawHud(render: RenderPort, snapshot: WorldSnapshot): void {
  render.setRegion('hud');
  const { x, y, size, spacing } = HUD_LAYOUT.lives;
  const reserve = Math.max(snapshot.lives - 1, 0);
  for (let i = 0; i < reserve; i += 1) {
    render.drawRect(x + i * spacing, y, size, size, Palette.lifeIcon);
  }
}
