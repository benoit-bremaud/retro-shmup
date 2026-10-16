import type { FontId } from '../ports/render-port';
import type { MessageKey } from '../i18n/messages';
import { FIELD_HEIGHT } from './screen';

/** A menu row is 16 logical px high, a comfortable touch target at the usual scales (§9.1). */
export const MENU_ROW_HEIGHT = 16;

/** The field y of the first row's top edge: the rows are centred on the field. */
export function menuTop(rowCount: number): number {
  return (FIELD_HEIGHT - rowCount * MENU_ROW_HEIGHT) / 2;
}

/** How far above the first row a header's top sits, by the font it is drawn in. */
export const MENU_HEADER_GAP: Readonly<Record<Extract<FontId, 'title' | 'menu'>, number>> = {
  title: 32,
  menu: MENU_ROW_HEIGHT,
};

/** What a menu shows: the presentation reads this, never the scene's `Menu` itself. */
export interface MenuView {
  readonly rows: readonly MessageKey[];
  readonly top: number;
  readonly highlighted: number;
}

/** A menu screen: its rows and the header drawn above them (GDD v0.13 §9.1). */
export interface MenuScreen {
  readonly menu: MenuView;
  /** The line above the rows, in its font; the title menu has none. */
  readonly header?: { readonly key: MessageKey; readonly font: Extract<FontId, 'title' | 'menu'> };
  /** The value a row shows on its right (a switch, a choice or a volume step), if any; built once. */
  readonly value?: (row: MessageKey) => MessageKey | number | undefined;
}

/** A row with a value: its label starts here and its value ends at the mirror edge. */
export const MENU_VALUE_MARGIN = 24;

/**
 * The controls screen's columns (GDD v0.15 §4.2): an intent label of 6 characters, then two slot
 * cells of 10 characters (80 px each) — 8 + 48 + 8 + 80 + 8 + 80 = 232 of the 240 px.
 */
export const CONTROLS_COLUMNS = { label: 8, slots: [64, 152], slotWidth: 80 } as const;

/** A slot column of the controls screen: 0 the primary slot, 1 the secondary. */
export type SlotColumn = 0 | 1;

/** What the controls screen shows: its rows, the highlighted cell and each slot's text. */
export interface ControlsView {
  readonly menu: MenuView;
  /** Rows `0` to `intentRows - 1` carry slot cells; the rows after them are centred actions. */
  readonly intentRows: number;
  readonly column: SlotColumn;
  /** *KEYBOARD* or *GAMEPAD*, under the header. */
  readonly deviceName: MessageKey;
  /** A slot cell's text for intent row `row` (0 to 6), built by no draw. */
  cell(row: number, column: SlotColumn): string;
}

/**
 * The name entry's letter grid (GDD v0.16 §9.1): cells of 30 × 20 px, eight to a row, filling the
 * field's width under the name being built; *SKIP* is one more row, the grid's width.
 */
export const LETTER_GRID = { top: 120, cellWidth: 30, cellHeight: 20, columns: 8 } as const;

/** The name entry above its grid: the heading, then the slots of the name or the code. */
export const NAME_ENTRY_LAYOUT = { headingY: 48, slotsY: 88, slotWidth: 16 } as const;

/**
 * One cell of the letter grid, placed on it: `span` columns wide from `column`. The scene reads its
 * `action`; the presentation draws its `text` or `label` only.
 */
export interface GridCell<Action extends string = string> {
  readonly action: Action;
  /** The character a `char` cell adds, else `''`. */
  readonly text: string;
  /** The catalogue text an action cell shows. */
  readonly label?: MessageKey;
  readonly row: number;
  readonly column: number;
  readonly span: number;
}

/** What the letter grid shows: its cells, the highlighted one, and which ones show. */
export interface LetterGridView {
  readonly cells: readonly GridCell[];
  readonly cursor: number;
  /** False for *OK* while the country code is incomplete or unknown: not drawn, not reached. */
  available(index: number): boolean;
}

/** What the name entry shows (GDD v0.16 §9.1): its heading, the slots and the grid. */
export interface NameEntryView {
  readonly heading: MessageKey;
  /** 8 for the name, 2 for the country code. */
  readonly slotCount: number;
  /** The character in slot `index`, `'-'` when empty; built by no draw. */
  slot(index: number): string;
  /** The slot on the bar: the next one to fill, or −1 when full. */
  readonly nextSlot: number;
  readonly grid: LetterGridView;
}
