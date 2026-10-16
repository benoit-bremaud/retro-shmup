import type { Slot } from '../input/bindings-editor';
import { REMAPPABLE_INTENTS } from '../ports/input-port';
import type { IntentFrame, RemappableIntent } from '../ports/input-port';
import type { MessageKey } from '../i18n/messages';
import { CONTROLS_COLUMNS, CONTROLS_HEADER_GAP } from '../presentation/menu-layout';
import type { SlotColumn } from '../presentation/menu-layout';
import { Menu } from './menu';

/** What the controls screen does after a step (GDD v0.15 §4.2). */
export type GridAction =
  | { readonly kind: 'capture'; readonly intent: RemappableIntent; readonly slot: Slot }
  | { readonly kind: 'restore' }
  | { readonly kind: 'back' };

/** Each intent's row label: a typed record, so an intent without a label does not compile. */
const INTENT_LABELS: Readonly<Record<RemappableIntent, MessageKey>> = {
  moveUp: 'up',
  moveDown: 'down',
  moveLeft: 'left',
  moveRight: 'right',
  fire: 'fire',
  bomb: 'bomb',
  pause: 'pause',
};

/** The rows, derived from `REMAPPABLE_INTENTS` (row `i` is intent `i`), then the two actions. */
const ROWS: readonly MessageKey[] = [
  ...REMAPPABLE_INTENTS.map((intent) => INTENT_LABELS[intent]),
  'restoreDefaults',
  'back',
];

/** The rows that carry slot cells, before the two actions. */
export const INTENT_ROWS = REMAPPABLE_INTENTS.length;

const SLOTS: readonly Slot[] = ['primary', 'secondary'];

/** Every capture action, built once: `CAPTURES[row][column]`. */
const CAPTURES: readonly (readonly GridAction[])[] = REMAPPABLE_INTENTS.map((intent) =>
  SLOTS.map((slot) => ({ kind: 'capture', intent, slot })),
);
const RESTORE: GridAction = { kind: 'restore' };
const BACK: GridAction = { kind: 'back' };

/** The column under a field x, or `undefined` over the labels. */
function columnAt(x: number): SlotColumn | undefined {
  if (x >= CONTROLS_COLUMNS.slots[1]) return 1;
  if (x >= CONTROLS_COLUMNS.slots[0]) return 0;
  return undefined;
}

/**
 * The controls screen's two-column menu (GDD v0.15 §4.2, meta/04-class-menus): one row per
 * remappable intent with its two slot cells, then *Restore defaults* and *Back*. The rows are a
 * `Menu` (up and down, `confirm`, release over the pressed row, the guards); left and right, the
 * hover and the tap's x choose the column. Activating an intent row starts the capture of the
 * highlighted cell.
 */
export class ControlsGrid {
  readonly menu = new Menu<MessageKey>(ROWS, { headerGap: CONTROLS_HEADER_GAP });
  column: SlotColumn = 0;

  /** Opens the screen on the first cell, primary column (see `Menu.reset`). */
  reset(now: number, opening: Readonly<IntentFrame>): void {
    this.menu.reset(now, opening);
    this.column = 0;
  }

  /** One step of input; returns what to do, or `undefined`. */
  step(frame: Readonly<IntentFrame>, now: number): GridAction | undefined {
    const row = this.menu.step(frame, now);
    // Left, right and the hover change the column on the intent rows only (GDD v0.15 §4.2).
    if (this.menu.highlighted < INTENT_ROWS) {
      const turned = this.menu.lastSideways;
      if (turned !== 0) this.column = turned > 0 ? 1 : 0;
      if (frame.hovered) this.column = columnAt(frame.hoverX) ?? this.column;
    }
    if (row === undefined) return undefined;
    if (row === 'restoreDefaults') return RESTORE;
    if (row === 'back') return BACK;
    // A tap or click starts the capture of the cell under its release; over a label, nothing.
    if (frame.releaseRegion === 'field') {
      const column = columnAt(frame.releaseX);
      if (column === undefined) return undefined;
      this.column = column;
    }
    return CAPTURES[this.menu.highlighted]?.[this.column];
  }
}
