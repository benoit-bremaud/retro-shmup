// Overlays of the frozen scenes (meta/05-state-scenes): pure draw functions, so the scene machine
// only picks which ones a scene shows (ADR-0010: no drawing inside the navigator). Each selects the
// field region it draws in.
import { BossState } from '../game/boss';
import type { BossSnapshot } from '../game/run';
import { BossHudTuning, SceneTuning, toSteps } from '../game/tuning';
import { message } from '../i18n/messages';
import type { Language, MessageKey } from '../i18n/messages';
import { HUD_FONT_CELL, MENU_FONT_CELL, TITLE_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { MENU_HEADER_GAP, MENU_ROW_HEIGHT, MENU_VALUE_MARGIN } from './menu-layout';
import type { MenuScreen, MenuView } from './menu-layout';
import { Palette } from './palette';
import { FIELD_HEIGHT, FIELD_WIDTH } from './screen';

const COUNT_IN_DIGITS = ['1', '2', '3'] as const;
const STEPS_PER_DIGIT = toSteps(SceneTuning.countInSeconds) / COUNT_IN_DIGITS.length;
const WARNING_HALF_STEPS = toSteps(BossHudTuning.warningBlinkHalfSeconds);

/** The dark veil over the whole field, under the pause and Game over overlays. */
export function drawVeil(render: RenderPort): void {
  render.setRegion('field');
  render.drawRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT, Palette.veil);
}

/** Horizontal room around a highlighted row's text, each side. */
const HIGHLIGHT_PAD = 8;

/** The width in logical pixels of `text` in the menu font. */
function menuTextWidth(text: string): number {
  return (text.length - 1) * MENU_FONT_CELL.width + MENU_FONT_CELL.glyphWidth;
}

/** A line of menu text centred on the field at the top `y`. */
function drawMenuLine(render: RenderPort, text: string, y: number): void {
  render.setRegion('field');
  render.drawText(text, Math.round((FIELD_WIDTH - menuTextWidth(text)) / 2), y, 'menu');
}

/**
 * A menu (GDD v0.13 and v0.14 §9.1): each row's catalogue text centred in its 16 px row, or, for a
 * row with a value, the label on the left and the value on the right; the highlighted row on a
 * bar. Draws from the catalogue each frame and builds no string.
 */
export function drawMenu(
  render: RenderPort,
  menu: MenuView,
  language: Language,
  value?: (row: MessageKey) => MessageKey | undefined,
): void {
  render.setRegion('field');
  const textTop = (MENU_ROW_HEIGHT - MENU_FONT_CELL.height) / 2;
  for (let i = 0; i < menu.rows.length; i += 1) {
    const key = menu.rows[i];
    if (key === undefined) continue;
    const text = message(key, language);
    const valueKey = value?.(key);
    const y = menu.top + i * MENU_ROW_HEIGHT;
    if (i === menu.highlighted) {
      const width =
        valueKey === undefined
          ? menuTextWidth(text) + 2 * HIGHLIGHT_PAD
          : FIELD_WIDTH - 2 * (MENU_VALUE_MARGIN - HIGHLIGHT_PAD);
      const x = Math.round((FIELD_WIDTH - width) / 2);
      render.drawRect(x, y, width, MENU_ROW_HEIGHT, Palette.menuHighlight);
    }
    if (valueKey === undefined) {
      drawMenuLine(render, text, y + textTop);
      continue;
    }
    const shown = message(valueKey, language);
    render.drawText(text, MENU_VALUE_MARGIN, y + textTop, 'menu');
    render.drawText(
      shown,
      FIELD_WIDTH - MENU_VALUE_MARGIN - menuTextWidth(shown),
      y + textTop,
      'menu',
    );
  }
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

/** A whole menu screen over the veil: its header, then its rows (GDD v0.13 §9.1). */
export function drawMenuScreen(render: RenderPort, screen: MenuScreen, language: Language): void {
  drawVeil(render);
  const header = screen.header;
  if (header !== undefined) {
    const headerY = screen.menu.top - MENU_HEADER_GAP[header.font];
    const text = message(header.key, language);
    if (header.font === 'title') drawBanner(render, text, headerY);
    else drawMenuLine(render, text, headerY);
  }
  drawMenu(render, screen.menu, language, screen.value);
}
