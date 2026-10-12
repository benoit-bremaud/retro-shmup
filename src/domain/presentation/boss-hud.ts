import { BossState } from '../game/boss';
import type { BossSnapshot } from '../game/run';
import { BossHudTuning } from '../game/tuning';
import { HUD_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { drawNumber } from './hud';
import { Palette } from './palette';

// The bar (GDD v0.10 §9.2, initial): a 1 px frame over x 8–232, y 4–8 of the play field.
const BAR_X = 8;
const BAR_Y = 4;
const BAR_WIDTH = 224;
const BAR_HEIGHT = 4;
const INSIDE_WIDTH = BAR_WIDTH - 2;
const INSIDE_HEIGHT = BAR_HEIGHT - 2;
// The seconds left, in HUD digits right-aligned under the end of the bar: two cells over x 218–232,
// y 12–22; below 10 the one digit takes the right-hand cell.
const SECONDS_X = 218;
const SECONDS_Y = 12;
const SECONDS_CELLS = 2;

/**
 * Draws the boss's HP bar and the seconds left in the play field, from the start of its entry
 * until its destroyed or fleeing sequence ends (GDD v0.10 §6). The fill follows the HP left, and
 * a tick marks the phase-2 threshold, drawn even over an empty bar. Allocates nothing.
 */
export function drawBossBar(render: RenderPort, boss: BossSnapshot): void {
  if (boss.state === BossState.Idle || boss.state === BossState.Warning) return;
  render.setRegion('field');
  render.drawRect(BAR_X + 1, BAR_Y + 1, INSIDE_WIDTH, INSIDE_HEIGHT, Palette.bossBarTrack);
  const fill = Math.round(INSIDE_WIDTH * boss.hpRatio);
  if (fill > 0) render.drawRect(BAR_X + 1, BAR_Y + 1, fill, INSIDE_HEIGHT, Palette.bossBarFill);
  const tickX = BAR_X + 1 + Math.round(INSIDE_WIDTH * BossHudTuning.barTickRatio);
  render.drawRect(tickX, BAR_Y, 1, BAR_HEIGHT, Palette.bossBarTick);
  render.drawRect(BAR_X, BAR_Y, BAR_WIDTH, 1, Palette.bossBarFrame);
  render.drawRect(BAR_X, BAR_Y + BAR_HEIGHT - 1, BAR_WIDTH, 1, Palette.bossBarFrame);
  render.drawRect(BAR_X, BAR_Y, 1, BAR_HEIGHT, Palette.bossBarFrame);
  render.drawRect(BAR_X + BAR_WIDTH - 1, BAR_Y, 1, BAR_HEIGHT, Palette.bossBarFrame);
  const cells = boss.secondsLeft >= 10 ? SECONDS_CELLS : 1;
  drawNumber(
    render,
    boss.secondsLeft,
    SECONDS_X + (SECONDS_CELLS - cells) * HUD_FONT_CELL.width,
    SECONDS_Y,
    cells,
  );
}
