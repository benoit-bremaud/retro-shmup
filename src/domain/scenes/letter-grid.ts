import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import { LETTER_GRID } from '../presentation/menu-layout';
import type { GridCell, LetterGridView } from '../presentation/menu-layout';
import { NO_ROW, PressGuard, sidewaysOf, verticalOf } from './menu-input';

/**
 * The name entry's two-dimensional menu (GDD v0.16 §9.1, meta/04-class-menus): the directions move
 * a wrapping cursor over the cells, skipping empty places and unavailable cells; a wide cell is
 * reached from any of its columns, and leaving it up or down keeps the column the cursor came
 * from. `Confirm`, or a release over the cell the press started on (`Menu`'s guards), picks the
 * highlighted cell; the hovering mouse highlights.
 */
export class LetterGrid<Action extends string> implements LetterGridView {
  readonly cells: readonly GridCell<Action>[];
  private at = 0;
  private readonly rows: number;
  /** The cell index at each place, row by row, or `NO_ROW` for an empty place. */
  private readonly places: readonly number[];
  /** The column the cursor stands in: on a wide cell, the one it came from. */
  private column = 0;
  private direction = 0;
  private sideways = 0;
  private readonly guard = new PressGuard();
  private readonly isAvailable: (cell: GridCell<Action>) => boolean;

  constructor(
    cells: readonly GridCell<Action>[],
    available: (cell: GridCell<Action>) => boolean = () => true,
  ) {
    this.cells = cells;
    this.isAvailable = available;
    let rows = 0;
    for (let i = 0; i < cells.length; i += 1) rows = Math.max(rows, (cells[i]?.row ?? 0) + 1);
    this.rows = rows;
    const places: number[] = new Array<number>(rows * LETTER_GRID.columns).fill(NO_ROW);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (cell === undefined) continue;
      for (let c = 0; c < cell.span; c += 1)
        places[cell.row * LETTER_GRID.columns + cell.column + c] = i;
    }
    this.places = places;
  }

  /** The highlighted cell's index. */
  get cursor(): number {
    return this.at;
  }

  available(index: number): boolean {
    const cell = this.cells[index];
    return cell !== undefined && this.isAvailable(cell);
  }

  /**
   * Opens on cell `start` (the first by default); what `opening` holds counts as held, its press
   * never acts.
   */
  reset(now: number, opening: Readonly<IntentFrame>, start = 0): void {
    this.at = start;
    this.column = this.cells[start]?.column ?? 0;
    this.direction = verticalOf(opening);
    this.sideways = sidewaysOf(opening);
    this.guard.open(now);
  }

  /** The cell at the field point, or `NO_ROW`. */
  cellAt(x: number, y: number): number {
    const row = Math.floor((y - LETTER_GRID.top) / LETTER_GRID.cellHeight);
    const column = Math.floor(x / LETTER_GRID.cellWidth);
    if (row < 0 || row >= this.rows || column < 0 || column >= LETTER_GRID.columns) return NO_ROW;
    const index = this.places[row * LETTER_GRID.columns + column] ?? NO_ROW;
    return index !== NO_ROW && this.available(index) ? index : NO_ROW;
  }

  /** One scene step of input; returns the cell picked, or `undefined`. */
  step(frame: Readonly<IntentFrame>, now: number): GridCell<Action> | undefined {
    this.move(frame);
    if (frame.hovered) this.pointAt(frame.hoverX, frame.hoverY);
    if (frame.tapRegion === 'field') this.guard.press(this.cellAt(frame.tapX, frame.tapY), now);
    if (frame.releaseRegion !== 'none') {
      const released =
        frame.releaseRegion === 'field' ? this.cellAt(frame.releaseX, frame.releaseY) : NO_ROW;
      if (this.guard.release(released, now)) {
        this.pointAt(frame.releaseX, frame.releaseY);
        return this.cells[released];
      }
    }
    if ((frame.pressed & Button.Confirm) !== 0 && this.available(this.at)) {
      return this.cells[this.at];
    }
    return undefined;
  }

  /** Moves the cursor off a cell that just became unavailable, to the previous one in its row. */
  settle(): void {
    if (!this.available(this.at)) this.moveSideways(-1);
  }

  private pointAt(x: number, y: number): void {
    const index = this.cellAt(x, y);
    if (index === NO_ROW) return;
    this.at = index;
    this.column = Math.floor(x / LETTER_GRID.cellWidth);
  }

  private move(frame: Readonly<IntentFrame>): void {
    const vertical = verticalOf(frame);
    if (vertical !== 0 && vertical !== this.direction) this.moveVertically(vertical);
    this.direction = vertical;
    const sideways = sidewaysOf(frame);
    if (sideways !== 0 && sideways !== this.sideways) this.moveSideways(sideways);
    this.sideways = sideways;
  }

  /** To the next row holding an available cell in the cursor's column, wrapping. */
  private moveVertically(direction: number): void {
    const row = this.cells[this.at]?.row ?? 0;
    for (let step = 1; step < this.rows; step += 1) {
      const next = (row + direction * step + this.rows * step) % this.rows;
      const index = this.places[next * LETTER_GRID.columns + this.column] ?? NO_ROW;
      if (index !== NO_ROW && this.available(index)) {
        this.at = index;
        return;
      }
    }
  }

  /** To the next available cell of the row, wrapping within it. */
  private moveSideways(direction: number): void {
    const cell = this.cells[this.at];
    if (cell === undefined) return;
    const columns = LETTER_GRID.columns;
    for (let step = 1; step < columns; step += 1) {
      const column = (this.column + direction * step + columns * step) % columns;
      const index = this.places[cell.row * columns + column] ?? NO_ROW;
      if (index !== NO_ROW && index !== this.at && this.available(index)) {
        this.at = index;
        this.column = column;
        return;
      }
    }
  }
}
