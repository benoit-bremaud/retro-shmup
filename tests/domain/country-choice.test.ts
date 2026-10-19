import { describe, expect, it } from 'vitest';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { LETTER_GRID } from '../../src/domain/presentation/menu-layout';
import { CountryChoice } from '../../src/domain/scenes/country-choice';

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

const CONFIRM = frame({ pressed: Button.Confirm });
const BACK = frame({ pressed: Button.Back });

/** Steps well apart, past every guard: each test's clock. */
let clock = 1000;

function pointOf(choice: CountryChoice, key: string): { x: number; y: number } {
  const cell = choice.grid.cells.find((candidate) => (candidate.label ?? candidate.text) === key);
  if (cell === undefined) throw new Error(`no cell ${key}`);
  return {
    x: cell.column * LETTER_GRID.cellWidth + LETTER_GRID.cellWidth / 2,
    y: LETTER_GRID.top + cell.row * LETTER_GRID.cellHeight + LETTER_GRID.cellHeight / 2,
  };
}

function pick(choice: CountryChoice, key: string): ReturnType<CountryChoice['step']> {
  const { x, y } = pointOf(choice, key);
  clock += 20;
  choice.step(frame({ tapRegion: 'field', tapX: x, tapY: y }), clock);
  return choice.step(frame({ releaseRegion: 'field', releaseX: x, releaseY: y }), clock + 1);
}

function hover(choice: CountryChoice, key: string): void {
  const { x, y } = pointOf(choice, key);
  clock += 20;
  choice.step(frame({ hovered: true, hoverX: x, hoverY: y }), clock);
}

function opened(preselected?: string): CountryChoice {
  const choice = new CountryChoice();
  choice.open(0, frame(), preselected);
  return choice;
}

function slots(choice: CountryChoice): string {
  return choice.slot(0) + choice.slot(1);
}

function cursorKey(choice: CountryChoice): string {
  const cell = choice.grid.cells[choice.grid.cursor];
  return cell?.label ?? cell?.text ?? '';
}

function okShown(choice: CountryChoice): boolean {
  return choice.grid.available(choice.grid.cells.findIndex((cell) => cell.label === 'ok'));
}

describe('CountryChoice (GDD v0.26 §9.1, ADR-0027 decision 6)', () => {
  it('shows the preselected known code with OK, the cursor on OK', () => {
    const choice = opened('FR');
    expect(choice.heading).toBe('country');
    expect(slots(choice)).toBe('FR');
    expect(choice.nextSlot).toBe(-1);
    expect(okShown(choice)).toBe(true);
    expect(cursorKey(choice)).toBe('ok');
    expect(choice.step(CONFIRM, (clock += 20))).toBe('chosen');
    expect(choice.choice).toBe('FR');
  });

  it.each(['XX', 'fr', 'FRA', 'none'])('preselects nothing from %s, the cursor on A', (code) => {
    const choice = opened(code);
    expect(slots(choice)).toBe('--');
    expect(cursorKey(choice)).toBe('A');
  });

  it('offers OK only for a complete code of the allowlist', () => {
    const choice = opened();
    pick(choice, 'Q');
    expect(okShown(choice)).toBe(false);
    pick(choice, 'Q');
    expect(okShown(choice)).toBe(false); // QQ is not a country
    expect(pick(choice, 'ok')).toBeUndefined();
    choice.step(BACK, (clock += 20));
    pick(choice, 'A');
    pick(choice, 'Z'); // a third letter is ignored
    expect(slots(choice)).toBe('QA');
    expect(okShown(choice)).toBe(true);
  });

  it('chooses no country on NONE', () => {
    const choice = opened('FR');
    expect(pick(choice, 'noCountry')).toBe('chosen');
    expect(choice.choice).toBe('none');
  });

  it('deletes on back and DEL, hiding OK again, and cancels on back with an empty code', () => {
    const choice = opened('FR');
    hover(choice, 'ok');
    expect(choice.step(BACK, (clock += 20))).toBeUndefined();
    expect(slots(choice)).toBe('F-');
    expect(okShown(choice)).toBe(false);
    expect(cursorKey(choice)).toBe('noCountry'); // moved off OK
    pick(choice, 'delete');
    expect(slots(choice)).toBe('--');
    expect(choice.step(BACK, (clock += 20))).toBe('cancelled');
  });

  it('never acts on the press that opened it', () => {
    const choice = new CountryChoice();
    const a = pointOf(choice, 'A');
    choice.open(2000, frame({ pressed: Button.Confirm }), undefined);
    choice.step(frame({ releaseRegion: 'field', releaseX: a.x, releaseY: a.y }), 2001);
    expect(slots(choice)).toBe('--');
  });

  it('starts afresh when it opens again', () => {
    const choice = opened('FR');
    pick(choice, 'noCountry');
    choice.open(500, frame(), undefined);
    expect(slots(choice)).toBe('--');
    expect(choice.grid.cursor).toBe(0);
  });
});
