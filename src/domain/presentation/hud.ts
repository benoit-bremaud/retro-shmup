import type { WorldSnapshot } from '../game/run';
import { HUD_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { HUD_LAYOUTS, PAUSE_BUTTONS, PORTRAIT_STRIP_EDGE } from './hud-layout';
import { Palette } from './palette';
import { FIELD_WIDTH, HUD_BAND_WIDTH, HUD_STRIP_HEIGHT } from './screen';

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
 * Draws the HUD background of the current screen (GDD §3.1, §9.2): the two landscape bands with
 * their edge lines, or the portrait strip with its bottom edge. Drawn in every scene, the title
 * included; the contents go over it.
 */
export function drawHudFrame(render: RenderPort): void {
  render.setRegion('hud');
  const layout = render.layout();
  if (layout.kind === 'portrait') {
    render.drawRect(0, 0, layout.width, HUD_STRIP_HEIGHT, Palette.hudBand);
    render.drawRect(0, PORTRAIT_STRIP_EDGE.y, PORTRAIT_STRIP_EDGE.width, 1, Palette.hudEdge);
    return;
  }
  const rightBandX = layout.fieldX + FIELD_WIDTH;
  render.drawRect(0, 0, HUD_BAND_WIDTH, layout.height, Palette.hudBand);
  render.drawRect(rightBandX, 0, HUD_BAND_WIDTH, layout.height, Palette.hudBand);
  render.drawRect(layout.fieldX - 1, 0, 1, layout.height, Palette.hudEdge);
  render.drawRect(rightBandX, 0, 1, layout.height, Palette.hudEdge);
}

/**
 * Draws the HUD contents (GDD §9.2) at the positions of the current screen: the score, the
 * multiplier, the chain bar and the reserve lives (the ship in play not counted). Allocates nothing.
 */
export function drawHud(render: RenderPort, snapshot: WorldSnapshot): void {
  render.setRegion('hud');
  const { score, multiplier, chainBar, lives } = HUD_LAYOUTS[render.layout().kind];
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

// Pause button glyph: two 4 × 16 bars, 4 px apart (05-state-scenes, devices brick additions).
const PAUSE_BAR_WIDTH = 4;
const PAUSE_BAR_HEIGHT = 16;
const PAUSE_BAR_GAP = 4;

/**
 * Draws the touch pause button of the current screen (GDD v0.7 §4.2): two bars centred in its
 * rectangle, over the band colour. The scene machine calls it in the scenes whose `pauseButton`
 * trait is true, whatever the device.
 */
export function drawPauseButton(render: RenderPort): void {
  render.setRegion('hud');
  const button = PAUSE_BUTTONS[render.layout().kind];
  const left = button.x + (button.width - 2 * PAUSE_BAR_WIDTH - PAUSE_BAR_GAP) / 2;
  const top = button.y + (button.height - PAUSE_BAR_HEIGHT) / 2;
  render.drawRect(left, top, PAUSE_BAR_WIDTH, PAUSE_BAR_HEIGHT, Palette.pauseButton);
  const right = left + PAUSE_BAR_WIDTH + PAUSE_BAR_GAP;
  render.drawRect(right, top, PAUSE_BAR_WIDTH, PAUSE_BAR_HEIGHT, Palette.pauseButton);
}
