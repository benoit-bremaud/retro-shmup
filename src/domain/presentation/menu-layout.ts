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
  /** The value a row shows on its right (a switch or a choice), if any; built once. */
  readonly value?: (row: MessageKey) => MessageKey | undefined;
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
