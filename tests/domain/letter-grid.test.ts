import { describe, expect, it } from 'vitest';
import { toSteps } from '../../src/domain/game/tuning';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { LETTER_GRID } from '../../src/domain/presentation/menu-layout';
import { LetterGrid } from '../../src/domain/scenes/letter-grid';
import { MenuTuning } from '../../src/domain/scenes/menu-input';
import { NAME_CELLS } from '../../src/domain/scenes/name-entry';
import { COUNTRY_CELLS } from '../../src/domain/scenes/country-choice';
import type { GridAction } from '../../src/domain/scenes/letter-grid';

const GUARD = toSteps(MenuTuning.rePressGuardSeconds);

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

function toward(moveX: number, moveY: number): IntentFrame {
  return frame({ moveKind: 'direction', moveX, moveY });
}

const RIGHT = toward(1, 0);
const LEFT = toward(-1, 0);
const DOWN = toward(0, 1);
const UP = toward(0, -1);
const IDLE = frame();

/** Steps each direction as a new press (released in between). */
function go(grid: LetterGrid<GridAction>, ...moves: IntentFrame[]): void {
  let now = 100;
  for (const move of moves) {
    grid.step(move, now);
    grid.step(IDLE, now + 1);
    now += 2;
  }
}

/** The label or character under the cursor. */
function current(grid: LetterGrid<GridAction>): string {
  const cell = grid.cells[grid.cursor];
  return cell?.label ?? cell?.text ?? '';
}

/** The field point at the middle of the place (`row`, `column`). */
function place(row: number, column: number): { x: number; y: number } {
  return {
    x: column * LETTER_GRID.cellWidth + LETTER_GRID.cellWidth / 2,
    y: LETTER_GRID.top + row * LETTER_GRID.cellHeight + LETTER_GRID.cellHeight / 2,
  };
}

function opened(
  cells = NAME_CELLS,
  available?: (label: string) => boolean,
): LetterGrid<GridAction> {
  const grid = new LetterGrid(
    cells,
    available === undefined ? undefined : (cell) => available(cell.label ?? cell.text),
  );
  grid.reset(0, IDLE);
  return grid;
}

describe('the grids (GDD v0.16 §9.1)', () => {
  it('lays the name grid out: 36 characters, SPACE two wide, DEL, OK, then SKIP on its own row', () => {
    const at = (key: string): readonly number[] => {
      const cell = NAME_CELLS.find((candidate) => (candidate.label ?? candidate.text) === key);
      return cell === undefined ? [] : [cell.row, cell.column, cell.span];
    };
    expect(NAME_CELLS).toHaveLength(40);
    expect(at('A')).toEqual([0, 0, 1]);
    expect(at('9')).toEqual([4, 3, 1]);
    expect(at('keySpace')).toEqual([4, 4, 2]);
    expect(at('delete')).toEqual([4, 6, 1]);
    expect(at('ok')).toEqual([4, 7, 1]);
    expect(at('skip')).toEqual([5, 0, 8]);
  });

  it('lays the country grid out: the letters, DEL, NONE two wide and OK', () => {
    const tail = COUNTRY_CELLS.slice(26).map((cell) => [cell.label, cell.row, cell.column]);
    expect(
      COUNTRY_CELLS.slice(0, 26)
        .map((cell) => cell.text)
        .join(''),
    ).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(tail).toEqual([
      ['delete', 3, 2],
      ['noCountry', 3, 3],
      ['ok', 3, 5],
    ]);
  });
});

describe('LetterGrid — directions (GDD v0.16 §9.1)', () => {
  it('starts on the first cell and moves one cell per new direction, a held one only once', () => {
    const grid = opened();
    expect(current(grid)).toBe('A');
    grid.step(RIGHT, 1);
    grid.step(RIGHT, 2);
    expect(current(grid)).toBe('B');
    grid.step(DOWN, 3);
    expect(current(grid)).toBe('J');
  });

  it('wraps within a row and between the first and last rows', () => {
    const grid = opened();
    go(grid, LEFT);
    expect(current(grid)).toBe('H');
    go(grid, RIGHT);
    expect(current(grid)).toBe('A');
    go(grid, UP);
    expect(current(grid)).toBe('skip');
    go(grid, DOWN);
    expect(current(grid)).toBe('A');
  });

  it('reaches a wide cell from either column and leaves it up by the column it came from', () => {
    const grid = opened();
    go(grid, UP, UP, LEFT, LEFT, LEFT); // row 4, column 5: SPACE's right half
    expect(current(grid)).toBe('keySpace');
    go(grid, UP);
    expect(current(grid)).toBe('3');
    go(grid, LEFT, DOWN); // column 4: SPACE's left half
    expect(current(grid)).toBe('keySpace');
    go(grid, UP);
    expect(current(grid)).toBe('2');
  });

  it('crosses a wide cell sideways in one move', () => {
    const grid = opened();
    go(grid, UP, UP, LEFT, LEFT, LEFT); // SPACE
    go(grid, RIGHT);
    expect(current(grid)).toBe('delete');
    go(grid, LEFT, LEFT);
    expect(current(grid)).toBe('9');
  });

  it('keeps the column across SKIP, which spans the whole row', () => {
    const grid = opened();
    go(grid, UP, UP, LEFT, LEFT); // DEL, column 6
    go(grid, DOWN);
    expect(current(grid)).toBe('skip');
    go(grid, DOWN);
    expect(current(grid)).toBe('G');
  });

  it('passes over the empty places and an unavailable cell', () => {
    const grid = opened(COUNTRY_CELLS, (label) => label !== 'ok');
    go(grid, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, DOWN, DOWN); // V, column 5
    expect(current(grid)).toBe('V');
    go(grid, DOWN); // OK is unavailable: on to the first row
    expect(current(grid)).toBe('F');
    go(grid, LEFT, LEFT, LEFT, UP); // C, then up to DEL in the last row
    expect(current(grid)).toBe('delete');
    go(grid, RIGHT, RIGHT); // NONE, then past OK and the empty places to Y
    expect(current(grid)).toBe('Y');
  });

  it('counts what the opening frame holds as held', () => {
    const grid = new LetterGrid(NAME_CELLS);
    grid.reset(0, DOWN);
    grid.step(DOWN, 1);
    expect(current(grid)).toBe('A');
  });
});

describe('LetterGrid — picking a cell (GDD v0.16 §9.1, the menus’ rules)', () => {
  it('picks the highlighted cell on Confirm, never an unavailable one', () => {
    const grid = opened(COUNTRY_CELLS, (label) => label !== 'ok');
    expect(grid.step(frame({ pressed: Button.Confirm }), 1)?.text).toBe('A');
    const blocked = opened(COUNTRY_CELLS, () => false);
    expect(blocked.step(frame({ pressed: Button.Confirm }), 1)).toBeUndefined();
  });

  it('picks the cell a press started on when released on it, and highlights it', () => {
    const grid = opened();
    const { x, y } = place(1, 2); // K
    expect(grid.step(frame({ tapRegion: 'field', tapX: x, tapY: y }), GUARD)).toBeUndefined();
    const picked = grid.step(
      frame({ releaseRegion: 'field', releaseX: x, releaseY: y }),
      GUARD + 1,
    );
    expect(picked?.text).toBe('K');
    expect(current(grid)).toBe('K');
  });

  it('picks nothing when the release lands on another cell or off the grid', () => {
    const grid = opened();
    const k = place(1, 2);
    const l = place(1, 3);
    grid.step(frame({ tapRegion: 'field', tapX: k.x, tapY: k.y }), GUARD);
    expect(
      grid.step(frame({ releaseRegion: 'field', releaseX: l.x, releaseY: l.y }), GUARD + 1),
    ).toBeUndefined();
    grid.step(frame({ tapRegion: 'field', tapX: k.x, tapY: k.y }), GUARD + 2);
    expect(
      grid.step(frame({ releaseRegion: 'field', releaseX: k.x, releaseY: 10 }), GUARD + 3),
    ).toBeUndefined();
  });

  it('ignores a press within the guard after opening', () => {
    const grid = opened();
    const { x, y } = place(0, 0);
    grid.step(frame({ tapRegion: 'field', tapX: x, tapY: y }), GUARD - 1);
    expect(
      grid.step(frame({ releaseRegion: 'field', releaseX: x, releaseY: y }), GUARD),
    ).toBeUndefined();
  });

  it('never picks an empty place or an unavailable cell under the pointer', () => {
    const grid = opened(COUNTRY_CELLS, (label) => label !== 'ok');
    expect(grid.cellAt(place(3, 5).x, place(3, 5).y)).toBe(-1); // OK
    expect(grid.cellAt(place(3, 7).x, place(3, 7).y)).toBe(-1); // empty
  });

  it('highlights the cell under the hovering mouse', () => {
    const grid = opened();
    const { x, y } = place(5, 4);
    grid.step(frame({ hovered: true, hoverX: x, hoverY: y }), 1);
    expect(current(grid)).toBe('skip');
    go(grid, UP); // the column hovered is kept
    expect(current(grid)).toBe('keySpace');
  });

  it('moves off a cell that became unavailable, to the previous one in its row', () => {
    let okShown = true;
    const grid = new LetterGrid(COUNTRY_CELLS, (cell) => cell.action !== 'ok' || okShown);
    grid.reset(0, IDLE);
    go(grid, UP, RIGHT, RIGHT, RIGHT, RIGHT); // OK
    expect(current(grid)).toBe('ok');
    okShown = false;
    grid.settle();
    expect(current(grid)).toBe('noCountry');
  });
});

describe('LetterGrid — edges of the pointer and the cursor', () => {
  it('keeps the cursor when the mouse hovers over an empty place', () => {
    const grid = opened(COUNTRY_CELLS);
    const { x, y } = place(3, 7); // past OK, nothing there
    grid.step(frame({ hovered: true, hoverX: x, hoverY: y }), 1);
    expect(current(grid)).toBe('A');
  });

  it('picks nothing from a release over the HUD', () => {
    const grid = opened();
    const { x, y } = place(0, 0);
    grid.step(frame({ tapRegion: 'field', tapX: x, tapY: y }), GUARD);
    expect(
      grid.step(frame({ releaseRegion: 'hud', releaseX: x, releaseY: y }), GUARD + 1),
    ).toBeUndefined();
  });

  it('does not move sideways from a start cell that does not exist', () => {
    const grid = new LetterGrid(NAME_CELLS);
    grid.reset(0, IDLE, NAME_CELLS.length + 5);
    go(grid, RIGHT);
    expect(grid.cursor).toBe(NAME_CELLS.length + 5);
  });

  it('moves down from a start cell that does not exist as from the first row', () => {
    const grid = new LetterGrid(NAME_CELLS);
    grid.reset(0, IDLE, NAME_CELLS.length + 5);
    go(grid, DOWN);
    expect(current(grid)).toBe('I');
  });
});
