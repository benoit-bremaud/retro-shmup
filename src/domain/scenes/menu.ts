import { toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import { MENU_ROW_HEIGHT, menuTop } from '../presentation/menu-layout';

/** Menu timing and input thresholds (GDD v0.13 §9.1); the geometry is the presentation's. */
export const MenuTuning = {
  /** A new press on the row just activated is ignored this long (a bouncing or doubled contact). */
  rePressGuardSeconds: 0.15,
  /** A stick tilt beyond this moves the highlight; below it is a hand resting on the stick. */
  directionThreshold: 0.5,
} as const;

/** `rowAt` returns it when no row is under the point. */
export const NO_ROW = -1;

const GUARD_STEPS = toSteps(MenuTuning.rePressGuardSeconds);

/**
 * One menu (GDD v0.13 §9.1, meta/04-class-menus): a vertical list of rows centred on the field,
 * one highlighted. Up and down move the highlight on each new direction, wrapping; `Confirm`
 * activates it. Touch and mouse activate the row a press started on when the release lands on it
 * too; a press on the row just activated is ignored for the guard; the hovering mouse highlights.
 * Rows are ids the scene maps to actions; time is counted in the scene's steps, never wall time.
 */
export class Menu<Id extends string> {
  readonly rows: readonly Id[];
  /** The field y of the first row's top edge. */
  readonly top: number;
  highlighted = 0;
  /** The direction held at the last step (−1, 0 or 1), so a held key moves only once. */
  private direction = 0;
  /** The row the current press started on, or `NO_ROW`. */
  private pressedRow = NO_ROW;
  private lastActivatedRow = NO_ROW;
  private lastActivationStep = 0;
  /** The step the menu last opened at; no press counts during the guard after it. */
  private openedAt = Number.NEGATIVE_INFINITY;

  constructor(rows: readonly Id[]) {
    this.rows = rows;
    this.top = menuTop(rows.length);
  }

  /**
   * Opens the menu at step `now` (callers go through the scene machine's one `openMenu`): back to
   * the first row with no press pending. A press
   * within the guard after opening is ignored too: a doubled contact on the row that opened this
   * menu never lands on the row now in its place (Quit, then Yes at the same height).
   */
  reset(now: number): void {
    this.highlighted = 0;
    this.direction = 0;
    this.pressedRow = NO_ROW;
    this.openedAt = now;
  }

  /** The row under the field y, or `NO_ROW`. */
  rowAt(y: number): number {
    const index = Math.floor((y - this.top) / MENU_ROW_HEIGHT);
    return index >= 0 && index < this.rows.length ? index : NO_ROW;
  }

  /** One scene step of input; returns the id of the row activated, or `undefined`. */
  step(frame: Readonly<IntentFrame>, now: number): Id | undefined {
    this.moveHighlight(frame);
    if (frame.hovered) {
      const hovered = this.rowAt(frame.hoverY);
      if (hovered !== NO_ROW) this.highlighted = hovered;
    }
    if (frame.tapRegion === 'field') this.press(this.rowAt(frame.tapY), now);
    if (frame.releaseRegion !== 'none') {
      const released = frame.releaseRegion === 'field' ? this.rowAt(frame.releaseY) : NO_ROW;
      if (this.release(released, now)) return this.rows[released];
    }
    if ((frame.pressed & Button.Confirm) !== 0) return this.rows[this.highlighted];
    return undefined;
  }

  private moveHighlight(frame: Readonly<IntentFrame>): void {
    let direction = 0;
    if (frame.moveKind === 'direction') {
      if (frame.moveY >= MenuTuning.directionThreshold) direction = 1;
      else if (frame.moveY <= -MenuTuning.directionThreshold) direction = -1;
    }
    if (direction !== 0 && direction !== this.direction) {
      this.highlighted = (this.highlighted + direction + this.rows.length) % this.rows.length;
    }
    this.direction = direction;
  }

  private press(row: number, now: number): void {
    const justOpened = now - this.openedAt < GUARD_STEPS;
    const repeated = row === this.lastActivatedRow && now - this.lastActivationStep < GUARD_STEPS;
    const guarded = justOpened || repeated;
    this.pressedRow = guarded ? NO_ROW : row;
  }

  private release(row: number, now: number): boolean {
    const activated = row !== NO_ROW && row === this.pressedRow;
    this.pressedRow = NO_ROW;
    if (!activated) return false;
    this.highlighted = row;
    this.lastActivatedRow = row;
    this.lastActivationStep = now;
    return true;
  }
}
