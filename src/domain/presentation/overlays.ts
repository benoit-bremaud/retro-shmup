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
import {
  CONTROLS_COLUMNS,
  MENU_HEADER_GAP,
  MENU_ROW_HEIGHT,
  MENU_VALUE_MARGIN,
} from './menu-layout';
import type { ControlsView, MenuScreen, MenuView, SlotColumn } from './menu-layout';
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
    if (valueKey === undefined) {
      drawActionRow(render, text, y, i === menu.highlighted);
      continue;
    }
    if (i === menu.highlighted) {
      const width = FIELD_WIDTH - 2 * (MENU_VALUE_MARGIN - HIGHLIGHT_PAD);
      const x = Math.round((FIELD_WIDTH - width) / 2);
      render.drawRect(x, y, width, MENU_ROW_HEIGHT, Palette.menuHighlight);
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

/**
 * The controls screen (GDD v0.15 §4.2): *CONTROLS* in the title font, the device edited, then one
 * row per intent — its label, then its two slot cells — and the two action rows, centred. One
 * cell, or one action row, is highlighted. Builds no string: the cells come from the view.
 */
export function drawControlsScreen(
  render: RenderPort,
  view: ControlsView,
  language: Language,
): void {
  drawVeil(render);
  const menu = view.menu;
  drawBanner(
    render,
    message('controls', language),
    menu.top - MENU_HEADER_GAP.title - MENU_ROW_HEIGHT,
  );
  drawMenuLine(render, message(view.deviceName, language), menu.top - MENU_ROW_HEIGHT);
  const textTop = (MENU_ROW_HEIGHT - MENU_FONT_CELL.height) / 2;
  const intents = view.intentRows;
  for (let i = 0; i < menu.rows.length; i += 1) {
    const key = menu.rows[i];
    if (key === undefined) continue;
    const y = menu.top + i * MENU_ROW_HEIGHT;
    if (i >= intents) {
      drawActionRow(render, message(key, language), y, i === menu.highlighted);
      continue;
    }
    if (i === menu.highlighted) {
      const x = CONTROLS_COLUMNS.slots[view.column];
      render.drawRect(x, y, CONTROLS_COLUMNS.slotWidth, MENU_ROW_HEIGHT, Palette.menuHighlight);
    }
    render.drawText(message(key, language), CONTROLS_COLUMNS.label, y + textTop, 'menu');
    drawCell(render, view.cell(i, 0), 0, y + textTop);
    drawCell(render, view.cell(i, 1), 1, y + textTop);
  }
}

/** A slot's text centred in its cell; an empty slot draws nothing. */
function drawCell(render: RenderPort, text: string, column: SlotColumn, y: number): void {
  if (text === '') return;
  const x = CONTROLS_COLUMNS.slots[column] + (CONTROLS_COLUMNS.slotWidth - menuTextWidth(text)) / 2;
  render.drawText(text, Math.round(x), y, 'menu');
}

/** A centred menu row, on its bar when highlighted, as in `drawMenu`. */
function drawActionRow(render: RenderPort, text: string, y: number, highlighted: boolean): void {
  if (highlighted) {
    const width = menuTextWidth(text) + 2 * HIGHLIGHT_PAD;
    render.drawRect(
      Math.round((FIELD_WIDTH - width) / 2),
      y,
      width,
      MENU_ROW_HEIGHT,
      Palette.menuHighlight,
    );
  }
  drawMenuLine(render, text, y + (MENU_ROW_HEIGHT - MENU_FONT_CELL.height) / 2);
}

/** The High scores columns (GDD v0.16 §9.1): 24 characters of 8 px, one space apart. */
const SCORE_COLUMNS = { rankEnd: 24, name: 32, country: 104, scoreEnd: 208, level: 224 } as const;
const SCORE_ROWS_TOP = 80;

/** One row of the high scores, as drawn: every field a string built when the screen opens. */
export interface HighScoreRow {
  readonly rank: string;
  readonly name: string;
  readonly country: string;
  readonly score: string;
  readonly level: string;
}

/** What the High scores screen shows: ten formatted rows and the highlighted rank, or −1. */
export interface HighScoresView {
  readonly rows: readonly HighScoreRow[];
  readonly highlighted: number;
}

/** The Ending card's layout (GDD v0.16 §9.1): the banner, then the score label and value. */
const ENDING_LAYOUT = { bannerY: 120, labelY: 160 } as const;
/** The high-score highlight leaves this margin on each side of the field. */
const SCORE_HIGHLIGHT_MARGIN = 8;

/** The High scores (GDD v0.16 §9.1): the heading, then one row per rank; builds no string. */
export function drawHighScores(render: RenderPort, view: HighScoresView, language: Language): void {
  drawVeil(render);
  drawMenuLine(render, message('highScores', language), SCORE_ROWS_TOP - 2 * MENU_ROW_HEIGHT);
  const textTop = (MENU_ROW_HEIGHT - MENU_FONT_CELL.height) / 2;
  for (let i = 0; i < view.rows.length; i += 1) {
    const row = view.rows[i];
    if (row === undefined) continue;
    const y = SCORE_ROWS_TOP + i * MENU_ROW_HEIGHT;
    if (i === view.highlighted) {
      const width = FIELD_WIDTH - 2 * SCORE_HIGHLIGHT_MARGIN;
      render.drawRect(SCORE_HIGHLIGHT_MARGIN, y, width, MENU_ROW_HEIGHT, Palette.menuHighlight);
    }
    const textY = y + textTop;
    render.drawText(row.rank, SCORE_COLUMNS.rankEnd - menuTextWidth(row.rank), textY, 'menu');
    render.drawText(row.name, SCORE_COLUMNS.name, textY, 'menu');
    if (row.country !== '') render.drawText(row.country, SCORE_COLUMNS.country, textY, 'menu');
    render.drawText(row.score, SCORE_COLUMNS.scoreEnd - menuTextWidth(row.score), textY, 'menu');
    if (row.level !== '') render.drawText(row.level, SCORE_COLUMNS.level, textY, 'menu');
  }
}

/** The Ending card (GDD v0.16 §9.1): *VICTORY* in the title font, then the final score. */
export function drawEnding(render: RenderPort, score: string, language: Language): void {
  drawVeil(render);
  drawBanner(render, message('victory', language), ENDING_LAYOUT.bannerY);
  drawMenuLine(render, message('score', language), ENDING_LAYOUT.labelY);
  drawMenuLine(render, score, ENDING_LAYOUT.labelY + MENU_ROW_HEIGHT);
}
