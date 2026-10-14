import { toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { MessageKey } from '../i18n/messages';
import { MENU_ROW_HEIGHT, menuTop } from '../presentation/menu-layout';
import type { MenuView } from '../presentation/menu-layout';

/** Menu timing and input thresholds (GDD v0.13 §9.1); the geometry is the presentation's. */
export const MenuTuning = {
  /** A new press on the row just activated is ignored this long (a bouncing or doubled contact). */
  rePressGuardSeconds: 0.15,
  /** A stick tilt beyond this moves the highlight; below it is a hand resting on the stick. */
  directionThreshold: 0.5,
} as const;

/** `rowAt` returns it when no row is under the point. */
export const NO_ROW = -1;

/** What a scene needs of a menu it opens and draws, whatever its row ids. */
export interface OpenableMenu extends MenuView {
  reset(now: number, opening: Readonly<IntentFrame>): void;
}

const GUARD_STEPS = toSteps(MenuTuning.rePressGuardSeconds);

/** The horizontal direction, or 0 when the tilt is mostly vertical. */
function sidewaysOf(frame: Readonly<IntentFrame>): number {
  return Math.abs(frame.moveY) > Math.abs(frame.moveX) ? 0 : axis(frame, frame.moveX);
}

/** −1, 0 or 1 for one axis of a keyboard or stick direction beyond the threshold. */
function axis(frame: Readonly<IntentFrame>, value: number): number {
  if (frame.moveKind !== 'direction') return 0;
  if (value >= MenuTuning.directionThreshold) return 1;
  if (value <= -MenuTuning.directionThreshold) return -1;
  return 0;
}

/**
 * One menu (GDD v0.13 §9.1, meta/04-class-menus): a vertical list of rows centred on the field,
 * one highlighted. Up and down move the highlight on each new direction, wrapping; `Confirm`
 * activates it. Touch and mouse activate the row a press started on when the release lands on it
 * too; a press on the row just activated is ignored for the guard; the hovering mouse highlights.
 * Rows are ids the scene maps to actions; time is counted in the scene's steps, never wall time.
 */
export class Menu<Id extends MessageKey> implements OpenableMenu {
  readonly rows: readonly Id[];
  /** The field y of the first row's top edge. */
  readonly top: number;
  highlighted = 0;
  /** The vertical direction held at the last step (−1, 0 or 1), so a held key moves only once. */
  private direction = 0;
  /** The same for the horizontal direction, which activates the highlighted row (GDD v0.14). */
  private sideways = 0;
  /** The new horizontal direction of the last step (−1, 0 or 1): the controls grid's column. */
  private turned = 0;
  /** The row the current press started on, or `NO_ROW`. */
  private pressedRow = NO_ROW;
  private lastActivatedRow = NO_ROW;
  private lastActivationStep = 0;
  /** The step the menu last opened at; no press counts during the guard after it. */
  private openedAt = Number.NEGATIVE_INFINITY;
  /** Which rows left and right flip (rows with a value, GDD v0.14 §9.1); none by default. */
  private readonly flips: (row: Id) => boolean;

  constructor(rows: readonly Id[], flips: (row: Id) => boolean = () => false) {
    this.rows = rows;
    this.top = menuTop(rows.length);
    this.flips = flips;
  }

  /**
   * Opens the menu at step `now`, from the frame `opening` that opens it (callers go through the
   * scene machine's one `openMenu`): back to the first row with no press pending. A press
   * within the guard after opening is ignored too: a doubled contact on the row that opened this
   * menu never lands on the row now in its place (Quit, then Yes at the same height).
   */
  reset(now: number, opening: Readonly<IntentFrame>): void {
    this.highlighted = 0;
    // The directions held in the frame that opens the menu count as already held: a key or stick
    // held while the menu opens (Pause pressed with an arrow down) moves and flips nothing.
    this.direction = axis(opening, opening.moveY);
    this.sideways = sidewaysOf(opening);
    this.pressedRow = NO_ROW;
    this.openedAt = now;
  }

  /**
   * A step the scene does not let the menu act on (the title lock): what is held counts as held
   * afterwards, and a press started now never activates.
   */
  ignore(frame: Readonly<IntentFrame>): void {
    this.direction = axis(frame, frame.moveY);
    this.sideways = sidewaysOf(frame);
    this.pressedRow = NO_ROW;
  }

  /** −1 or 1 when the last step brought a new left or right direction, else 0. */
  get lastSideways(): number {
    return this.turned;
  }

  /** The row under the field y, or `NO_ROW`. */
  rowAt(y: number): number {
    const index = Math.floor((y - this.top) / MENU_ROW_HEIGHT);
    return index >= 0 && index < this.rows.length ? index : NO_ROW;
  }

  /** One scene step of input; returns the id of the row activated, or `undefined`. */
  step(frame: Readonly<IntentFrame>, now: number): Id | undefined {
    this.moveHighlight(frame);
    const highlightedRow = this.rows[this.highlighted];
    const flipped =
      this.newSideways(frame) && highlightedRow !== undefined && this.flips(highlightedRow);
    if (frame.hovered) {
      const hovered = this.rowAt(frame.hoverY);
      if (hovered !== NO_ROW) this.highlighted = hovered;
    }
    if (frame.tapRegion === 'field') this.press(this.rowAt(frame.tapY), now);
    if (frame.releaseRegion !== 'none') {
      const released = frame.releaseRegion === 'field' ? this.rowAt(frame.releaseY) : NO_ROW;
      if (this.release(released, now)) return this.rows[released];
    }
    if ((frame.pressed & Button.Confirm) !== 0 || flipped) return this.rows[this.highlighted];
    return undefined;
  }

  private moveHighlight(frame: Readonly<IntentFrame>): void {
    const direction = axis(frame, frame.moveY);
    if (direction !== 0 && direction !== this.direction) {
      this.highlighted = (this.highlighted + direction + this.rows.length) % this.rows.length;
    }
    this.direction = direction;
  }

  /** True on a new left or right direction, unless the tilt is mostly vertical. */
  private newSideways(frame: Readonly<IntentFrame>): boolean {
    const sideways = sidewaysOf(frame);
    const flipped = sideways !== 0 && sideways !== this.sideways;
    this.sideways = sideways;
    this.turned = flipped ? sideways : 0;
    return flipped;
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
