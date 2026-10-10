import { HUD_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { Palette } from './palette';
import { FIELD_HEIGHT, FIELD_WIDTH } from './screen';

// Pause icon: two bars, 6 × 20 px, 6 px apart (wordless until the bitmap fonts).
const BAR_WIDTH = 6;
const BAR_HEIGHT = 20;
const BAR_GAP = 6;
const STEPS_PER_DIGIT = 20;
const COUNT_IN_DIGITS = ['1', '2', '3'] as const;
// A glyph is one cell wide minus the advance between characters.
const GLYPH_WIDTH = HUD_FONT_CELL.width - 2;

/**
 * Overlays of the frozen scenes (meta/05-state-scenes): pure draw functions, so the scene machine
 * only picks which ones a scene shows (ADR-0010: no drawing inside the navigator). Each selects the
 * field region it draws in.
 */
export function drawVeil(render: RenderPort): void {
  render.setRegion('field');
  render.drawRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT, Palette.veil);
}

export function drawPauseIcon(render: RenderPort): void {
  render.setRegion('field');
  const left = (FIELD_WIDTH - 2 * BAR_WIDTH - BAR_GAP) / 2;
  const top = (FIELD_HEIGHT - BAR_HEIGHT) / 2;
  render.drawRect(left, top, BAR_WIDTH, BAR_HEIGHT, Palette.pauseIcon);
  render.drawRect(left + BAR_WIDTH + BAR_GAP, top, BAR_WIDTH, BAR_HEIGHT, Palette.pauseIcon);
}

/** The 3-2-1 of the count-in, one digit per 20 steps, from the steps left (60 down to 1). */
export function drawCountIn(render: RenderPort, stepsLeft: number): void {
  const digit = COUNT_IN_DIGITS[Math.ceil(stepsLeft / STEPS_PER_DIGIT) - 1];
  if (digit === undefined) return;
  render.setRegion('field');
  render.drawText(
    digit,
    (FIELD_WIDTH - GLYPH_WIDTH) / 2,
    (FIELD_HEIGHT - HUD_FONT_CELL.height) / 2,
    'hud',
  );
}
