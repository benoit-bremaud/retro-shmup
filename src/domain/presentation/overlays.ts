// Overlays of the frozen scenes (meta/05-state-scenes): pure draw functions, so the scene machine
// only picks which ones a scene shows (ADR-0010: no drawing inside the navigator). Each selects the
// field region it draws in.
import { MAX_VOLUME_STEP } from '../audio/volume';
import { BossState } from '../game/boss';
import type { BossSnapshot } from '../game/run';
import { BossHudTuning, SceneTuning, toSteps } from '../game/tuning';
import { message } from '../i18n/messages';
import type { Language, MessageKey } from '../i18n/messages';
import type { RowValue } from '../options';
import {
  FLAG_GAP,
  FLAG_SIZE,
  HUD_FONT_CELL,
  MENU_FONT_CELL,
  TITLE_FONT_CELL,
} from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import {
  CONTROLS_COLUMNS,
  LETTER_GRID,
  MENU_HEADER_GAP,
  NAME_ENTRY_LAYOUT,
  CONTROLS_HEADER_GAP,
  MENU_ROW_HEIGHT,
  MENU_VALUE_MARGIN,
} from './menu-layout';
import type { ControlsView, MenuScreen, MenuView, NameEntryView, SlotColumn } from './menu-layout';
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

/** The flag's top for a line of menu text at `textY`: its 11 px centred on the 10 px cell. */
function flagTop(textY: number): number {
  return textY + Math.floor((MENU_FONT_CELL.height - FLAG_SIZE.height) / 2);
}

/** A line of menu text centred on the field at the top `y`. */
function drawMenuLine(render: RenderPort, text: string, y: number): void {
  render.setRegion('field');
  render.drawText(text, Math.round((FIELD_WIDTH - menuTextWidth(text)) / 2), y, 'menu');
}

/** A volume step's digits, built once: a draw builds no string (GDD v0.23 §9.3). */
const STEP_LABELS: readonly string[] = Array.from({ length: MAX_VOLUME_STEP + 1 }, (_, i) =>
  String(i),
);

/** The text a row value shows: a volume step's label, a code as is, or a catalogue text. */
function valueText(value: RowValue, language: Language): string {
  if (typeof value === 'number') return STEP_LABELS[value] ?? '';
  return typeof value === 'object' ? value.text : message(value, language);
}

/**
 * A menu (GDD v0.13 and v0.14 §9.1): each row's catalogue text centred in its row (16 to 32 px tall,
 * GDD v0.25), or, for a
 * row with a value, the label on the left and the value on the right; the highlighted row on a
 * bar. Draws from the catalogue each frame and builds no string.
 */
export function drawMenu(
  render: RenderPort,
  menu: MenuView,
  language: Language,
  value?: (row: MessageKey) => RowValue | undefined,
): void {
  render.setRegion('field');
  const rowHeight = menu.rowHeight;
  const textTop = (rowHeight - MENU_FONT_CELL.height) / 2;
  for (let i = 0; i < menu.rows.length; i += 1) {
    const key = menu.rows[i];
    if (key === undefined) continue;
    const text = message(key, language);
    const valueKey = value?.(key);
    const y = menu.top + i * rowHeight;
    if (valueKey === undefined) {
      drawActionRow(render, text, y, rowHeight, i === menu.highlighted);
      continue;
    }
    if (i === menu.highlighted) {
      const width = FIELD_WIDTH - 2 * (MENU_VALUE_MARGIN - HIGHLIGHT_PAD);
      const x = Math.round((FIELD_WIDTH - width) / 2);
      render.drawRect(x, y, width, rowHeight, Palette.menuHighlight);
    }
    const shown = valueText(valueKey, language);
    render.drawText(text, MENU_VALUE_MARGIN, y + textTop, 'menu');
    let right = FIELD_WIDTH - MENU_VALUE_MARGIN;
    if (typeof valueKey === 'object' && valueKey.flag === true) {
      const flagX = right - FLAG_SIZE.width;
      if (render.drawFlag(shown, flagX, flagTop(y + textTop))) right = flagX - FLAG_GAP;
    }
    render.drawText(shown, right - menuTextWidth(shown), y + textTop, 'menu');
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
  const note = screen.note;
  if (note !== undefined)
    drawMenuLine(render, message(note, language), screen.menu.top - MENU_ROW_HEIGHT);
  if (header !== undefined) {
    const noteGap = note === undefined ? 0 : MENU_ROW_HEIGHT;
    const headerY = screen.menu.top - MENU_HEADER_GAP[header.font] - noteGap;
    const text = message(header.key, language);
    if (header.font === 'title') drawBanner(render, text, headerY);
    else drawMenuLine(render, text, headerY);
  }
  drawMenu(render, screen.menu, language, screen.value);
}

/**
 * A one-line status at the foot of the field (GDD v0.26 §9.1): *OPEN BLOCKED* when the browser
 * refused the form's tab, over the screen that tried.
 */
export function drawStatusLine(render: RenderPort, key: MessageKey, language: Language): void {
  drawMenuLine(render, message(key, language), FIELD_HEIGHT - 2 * MENU_ROW_HEIGHT);
}

/** The gesture prompt (ADR-0009, GDD v0.26 §9.1): a gamepad waits for a tap, click or key. */
export function drawGesturePrompt(render: RenderPort, language: Language): void {
  drawVeil(render);
  drawMenuLine(render, message('gesturePrompt', language), (FIELD_HEIGHT - MENU_ROW_HEIGHT) / 2);
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
  drawBanner(render, message('controls', language), menu.top - CONTROLS_HEADER_GAP);
  drawMenuLine(render, message(view.deviceName, language), menu.top - MENU_ROW_HEIGHT);
  const rowHeight = menu.rowHeight;
  const textTop = (rowHeight - MENU_FONT_CELL.height) / 2;
  const intents = view.intentRows;
  for (let i = 0; i < menu.rows.length; i += 1) {
    const key = menu.rows[i];
    if (key === undefined) continue;
    const y = menu.top + i * rowHeight;
    if (i >= intents) {
      drawActionRow(render, message(key, language), y, rowHeight, i === menu.highlighted);
      continue;
    }
    if (i === menu.highlighted) {
      const x = CONTROLS_COLUMNS.slots[view.column];
      render.drawRect(x, y, CONTROLS_COLUMNS.slotWidth, rowHeight, Palette.menuHighlight);
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
function drawActionRow(
  render: RenderPort,
  text: string,
  y: number,
  rowHeight: number,
  highlighted: boolean,
): void {
  if (highlighted) {
    const width = menuTextWidth(text) + 2 * HIGHLIGHT_PAD;
    render.drawRect(
      Math.round((FIELD_WIDTH - width) / 2),
      y,
      width,
      rowHeight,
      Palette.menuHighlight,
    );
  }
  drawMenuLine(render, text, y + (rowHeight - MENU_FONT_CELL.height) / 2);
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
    if (row.country !== '') {
      render.drawText(row.country, SCORE_COLUMNS.country, textY, 'menu');
      render.drawFlag(
        row.country,
        SCORE_COLUMNS.country + menuTextWidth(row.country) + FLAG_GAP,
        flagTop(textY),
      );
    }
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

/**
 * The name entry (GDD v0.16 §9.1): the heading in the title font, the slots of the name or the
 * code (`-` when empty, the next one on a bar), then the grid, each cell's text centred in it and
 * the highlighted cell on a bar; an unavailable cell (*OK* before a known code) is not drawn.
 */
export function drawNameEntry(render: RenderPort, view: NameEntryView, language: Language): void {
  drawVeil(render);
  drawBanner(render, message(view.heading, language), NAME_ENTRY_LAYOUT.headingY);
  const width = NAME_ENTRY_LAYOUT.slotWidth;
  const left = (FIELD_WIDTH - view.slotCount * width) / 2;
  const slotsY = NAME_ENTRY_LAYOUT.slotsY;
  const textTop = (MENU_ROW_HEIGHT - MENU_FONT_CELL.height) / 2;
  for (let i = 0; i < view.slotCount; i += 1) {
    const x = left + i * width;
    if (i === view.nextSlot)
      render.drawRect(x, slotsY, width, MENU_ROW_HEIGHT, Palette.menuHighlight);
    const text = view.slot(i);
    render.drawText(
      text,
      Math.round(x + (width - menuTextWidth(text)) / 2),
      slotsY + textTop,
      'menu',
    );
  }
  if (view.knownCode !== '') {
    const flagX = left + view.slotCount * width + FLAG_GAP;
    render.drawFlag(view.knownCode, flagX, flagTop(slotsY + textTop));
  }
  const grid = view.grid;
  const cellTextTop = (LETTER_GRID.cellHeight - MENU_FONT_CELL.height) / 2;
  for (let i = 0; i < grid.cells.length; i += 1) {
    const cell = grid.cells[i];
    if (cell === undefined || !grid.available(i)) continue;
    const x = cell.column * LETTER_GRID.cellWidth;
    const y = LETTER_GRID.top + cell.row * LETTER_GRID.cellHeight;
    const cellWidth = cell.span * LETTER_GRID.cellWidth;
    if (i === grid.cursor) {
      // The whole cell is the tap target; the bar keeps a 1 px gap above and below (GDD v0.26).
      render.drawRect(x, y + 1, cellWidth, LETTER_GRID.cellHeight - 2, Palette.menuHighlight);
    }
    const text = cell.label === undefined ? cell.text : message(cell.label, language);
    render.drawText(
      text,
      Math.round(x + (cellWidth - menuTextWidth(text)) / 2),
      y + cellTextTop,
      'menu',
    );
  }
}
