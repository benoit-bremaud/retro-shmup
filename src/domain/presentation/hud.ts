import type { WorldSnapshot } from '../game/run';
import { HUD_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { HUD_LAYOUT } from './hud-layout';
import { Palette } from './palette';

// One-character strings, interned once: a number is drawn digit by digit, with no formatting and no
// allocation (05-state-scenes, enemies brick presentation).
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const TIMES = '×';

/** Draws `value` right-aligned over `digits` cells, zero-padded, capped at all nines. */
function drawNumber(render: RenderPort, value: number, x: number, y: number, digits: number): void {
  let rest = Math.min(Math.max(Math.floor(value), 0), 10 ** digits - 1);
  for (let cell = digits - 1; cell >= 0; cell -= 1) {
    render.drawText(DIGITS[rest % 10] ?? '0', x + cell * HUD_FONT_CELL.width, y, 'hud');
    rest = Math.floor(rest / 10);
  }
}

/**
 * Draws the HUD contents in the left band (GDD §9.2): the score, the multiplier, the chain bar and
 * the reserve lives (the ship in play not counted). Allocates nothing.
 */
export function drawHud(render: RenderPort, snapshot: WorldSnapshot): void {
  render.setRegion('hud');
  const { score, multiplier, chainBar, lives } = HUD_LAYOUT;
  drawNumber(render, snapshot.score, score.x, score.y, score.digits);
  render.drawText(TIMES, multiplier.x, multiplier.y, 'hud');
  drawNumber(render, snapshot.multiplier, multiplier.x + HUD_FONT_CELL.width, multiplier.y, 1);
  render.drawRect(chainBar.x, chainBar.y, chainBar.width, chainBar.height, Palette.chainTrack);
  const fill = Math.round(chainBar.width * snapshot.chainRatio);
  if (fill > 0) render.drawRect(chainBar.x, chainBar.y, fill, chainBar.height, Palette.chainBar);
  const reserve = Math.max(snapshot.lives - 1, 0);
  for (let i = 0; i < reserve; i += 1) {
    render.drawRect(lives.x + i * lives.spacing, lives.y, lives.size, lives.size, Palette.lifeIcon);
  }
}
