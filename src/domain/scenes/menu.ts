import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { MessageKey } from '../i18n/messages';
import { MENU_ROW_HEIGHT, menuTop } from '../presentation/menu-layout';
import type { MenuView } from '../presentation/menu-layout';
import { axis, NO_ROW, PressGuard, sidewaysOf } from './menu-input';

/** What a scene needs of a menu it opens and draws, whatever its row ids. */
export interface OpenableMenu extends MenuView {
  reset(now: number, opening: Readonly<IntentFrame>): void;
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
  private readonly guard = new PressGuard();
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
    this.guard.open(now);
  }

  /**
   * A step the scene does not let the menu act on (the title lock): what is held counts as held
   * afterwards, and a press started now never activates.
   */
  ignore(frame: Readonly<IntentFrame>): void {
    this.direction = axis(frame, frame.moveY);
    this.sideways = sidewaysOf(frame);
    this.guard.cancel();
  }

  /**
   * −1 or 1 when the last step brought a new left or right direction, else 0. Valid right after
   * `step`, until the next one: the controls grid reads it there to choose its column.
   */
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
    if (frame.tapRegion === 'field') this.guard.press(this.rowAt(frame.tapY), now);
    if (frame.releaseRegion !== 'none') {
      const released = frame.releaseRegion === 'field' ? this.rowAt(frame.releaseY) : NO_ROW;
      if (this.guard.release(released, now)) {
        this.highlighted = released;
        return this.rows[released];
      }
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
}
