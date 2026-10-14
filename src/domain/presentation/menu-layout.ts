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
  readonly header: MessageKey;
  readonly headerFont: Extract<FontId, 'title' | 'menu'>;
}
