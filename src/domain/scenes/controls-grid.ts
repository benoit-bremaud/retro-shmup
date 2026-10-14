import type { Slot } from '../input/bindings-editor';
import { REMAPPABLE_INTENTS } from '../ports/input-port';
import type { IntentFrame, RemappableIntent } from '../ports/input-port';
import { CONTROLS_COLUMNS } from '../presentation/menu-layout';
import { Menu } from './menu';

/** What the controls screen does after a step (GDD v0.15 §4.2). */
export type GridAction =
  | { readonly kind: 'capture'; readonly intent: RemappableIntent; readonly slot: Slot }
  | { readonly kind: 'restore' }
  | { readonly kind: 'back' };

/** The rows' catalogue keys, in `REMAPPABLE_INTENTS` order, then the two actions. */
const ROWS = [
  'up',
  'down',
  'left',
  'right',
  'fire',
  'bomb',
  'pause',
  'restoreDefaults',
  'back',
] as const;
type ControlsRow = (typeof ROWS)[number];

const SLOTS: readonly Slot[] = ['primary', 'secondary'];

/** Every capture action, built once: `CAPTURES[row][column]`. */
const CAPTURES: readonly (readonly GridAction[])[] = REMAPPABLE_INTENTS.map((intent) =>
  SLOTS.map((slot) => ({ kind: 'capture', intent, slot })),
);
const RESTORE: GridAction = { kind: 'restore' };
const BACK: GridAction = { kind: 'back' };

/** The column under a field x, or `undefined` over the labels (the column is kept). */
function columnAt(x: number): 0 | 1 | undefined {
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
  readonly menu = new Menu<ControlsRow>(ROWS);
  column: 0 | 1 = 0;

  /** Opens the screen on the first cell, primary column (see `Menu.reset`). */
  reset(now: number, opening: Readonly<IntentFrame>): void {
    this.menu.reset(now, opening);
    this.column = 0;
  }

  /** One step of input; returns what to do, or `undefined`. */
  step(frame: Readonly<IntentFrame>, now: number): GridAction | undefined {
    const row = this.menu.step(frame, now);
    const turned = this.menu.lastSideways;
    if (turned !== 0) this.column = turned > 0 ? 1 : 0;
    if (frame.hovered) this.column = columnAt(frame.hoverX) ?? this.column;
    if (row === undefined) return undefined;
    if (row === 'restoreDefaults') return RESTORE;
    if (row === 'back') return BACK;
    // A tap or click chooses its cell: the column under the release.
    if (frame.releaseRegion === 'field') this.column = columnAt(frame.releaseX) ?? this.column;
    return CAPTURES[this.menu.highlighted]?.[this.column];
  }
}
