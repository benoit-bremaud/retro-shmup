// Overlays of the frozen scenes (meta/05-state-scenes): pure draw functions, so the scene machine
// only picks which ones a scene shows (ADR-0010: no drawing inside the navigator). Each selects the
// field region it draws in.
import { BossState } from '../game/boss';
import type { BossSnapshot } from '../game/run';
import { BossHudTuning, SceneTuning, toSteps } from '../game/tuning';
import { message } from '../i18n/messages';
import type { Language } from '../i18n/messages';
import { HUD_FONT_CELL, TITLE_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { Palette } from './palette';
import { FIELD_HEIGHT, FIELD_WIDTH } from './screen';

// Pause icon: two bars, 6 × 20 px, 6 px apart (wordless until the bitmap fonts).
const BAR_WIDTH = 6;
const BAR_HEIGHT = 20;
const BAR_GAP = 6;
const COUNT_IN_DIGITS = ['1', '2', '3'] as const;
const STEPS_PER_DIGIT = toSteps(SceneTuning.countInSeconds) / COUNT_IN_DIGITS.length;
const WARNING_HALF_STEPS = toSteps(BossHudTuning.warningBlinkHalfSeconds);

/** The dark veil over the whole field, under the pause and Game over overlays. */
export function drawVeil(render: RenderPort): void {
  render.setRegion('field');
  render.drawRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT, Palette.veil);
}

/** The wordless pause icon: two bars centred on the field. */
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
    (FIELD_WIDTH - HUD_FONT_CELL.glyphWidth) / 2,
    (FIELD_HEIGHT - HUD_FONT_CELL.height) / 2,
    'hud',
  );
}

/**
 * A line of `title` text centred on the field, rounded to whole pixels: the Game over message,
 * vertically centred unless a top `y` is given (the Results header).
 */
export function drawBanner(render: RenderPort, text: string, y?: number): void {
  const width = (text.length - 1) * TITLE_FONT_CELL.width + TITLE_FONT_CELL.glyphWidth;
  render.setRegion('field');
  render.drawText(
    text,
    Math.round((FIELD_WIDTH - width) / 2),
    y ?? Math.round((FIELD_HEIGHT - TITLE_FONT_CELL.height) / 2),
    'title',
  );
}

/**
 * The WARNING banner (GDD v0.10 §6, §9.7) while the boss is in its `WARNING` state: it blinks twice
 * in the 3 s, visible for the first half of each blink, from the steps spent in the state, so a
 * pause freezes it and wall time never enters. With the blink effect off it stays steady: the
 * announcement is information, not an effect. Drawn from the catalogue in the `title` font.
 */
export function drawWarning(
  render: RenderPort,
  boss: BossSnapshot,
  blink: boolean,
  language: Language,
): void {
  if (boss.state !== BossState.Warning) return;
  if (blink && Math.floor(boss.stateSteps / WARNING_HALF_STEPS) % 2 === 1) return;
  drawBanner(render, message('warning', language));
}
