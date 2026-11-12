import { createIntentFrame } from '../../src/domain/ports/input-port';
import { LETTER_GRID } from '../../src/domain/presentation/menu-layout';
import type { CountryChoice } from '../../src/domain/scenes/country-choice';

/** Steps well apart, past every guard. */
let clock = 1000;

/** The middle of the shown page's cell whose code, letter or label is `key`, in field pixels. */
export function pointOf(choice: CountryChoice, key: string): { x: number; y: number } {
  const cell = choice.grid.cells.find((candidate) => (candidate.label ?? candidate.text) === key);
  if (cell === undefined) throw new Error(`no cell ${key}`);
  return {
    x: (cell.column + cell.span / 2) * LETTER_GRID.cellWidth,
    y: LETTER_GRID.top + cell.row * LETTER_GRID.cellHeight + LETTER_GRID.cellHeight / 2,
  };
}

/** A tap on the cell `key` of the shown page; returns what the step answers on release. */
export function pick(choice: CountryChoice, key: string): ReturnType<CountryChoice['step']> {
  const { x, y } = pointOf(choice, key);
  clock += 20;
  choice.step(Object.assign(createIntentFrame(), { tapRegion: 'field', tapX: x, tapY: y }), clock);
  return choice.step(
    Object.assign(createIntentFrame(), { releaseRegion: 'field', releaseX: x, releaseY: y }),
    clock + 1,
  );
}

/** The next step time, past every guard. */
export function later(): number {
  clock += 20;
  return clock;
}

/** A choice opened on the common suggestions, then on its letters page with `code` typed. */
export function onLetters(choice: CountryChoice, code: string): CountryChoice {
  choice.open(0, createIntentFrame(), [], undefined);
  pick(choice, 'otherCountry');
  for (let i = 0; i < code.length; i += 1) pick(choice, code.charAt(i));
  return choice;
}
