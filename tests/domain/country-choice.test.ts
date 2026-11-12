import { describe, expect, it } from 'vitest';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { CountryChoice } from '../../src/domain/scenes/country-choice';
import { later, onLetters, pick, pointOf } from '../support/country-choice';

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

const CONFIRM = frame({ pressed: Button.Confirm });
const BACK = frame({ pressed: Button.Back });

function opened(hints: readonly string[] = [], saved?: string): CountryChoice {
  const choice = new CountryChoice();
  choice.open(0, frame(), hints, saved);
  return choice;
}

function shown(choice: CountryChoice): string[] {
  return choice.grid.cells.map((cell) => cell.label ?? cell.text);
}

function cursorKey(choice: CountryChoice): string {
  const cell = choice.grid.cells[choice.grid.cursor];
  return cell?.label ?? cell?.text ?? '';
}

function slots(choice: CountryChoice): string {
  return choice.slot(0) + choice.slot(1);
}

function okShown(choice: CountryChoice): boolean {
  return choice.grid.available(choice.grid.cells.findIndex((cell) => cell.label === 'ok'));
}

describe('CountryChoice suggestions (GDD v0.34 §9.1, ADR-0030)', () => {
  it('shows six flags, NONE and OTHER in two rows of four 60 px cells', () => {
    const choice = opened(['JP']);
    expect(choice.byLetters).toBe(false);
    expect(choice.heading).toBe('country');
    expect(shown(choice)).toEqual([
      'JP',
      'FR',
      'BE',
      'CH',
      'CA',
      'US',
      'noCountry',
      'otherCountry',
    ]);
    expect(choice.grid.cells.map((cell) => [cell.row, cell.column, cell.span])).toEqual([
      [0, 0, 2],
      [0, 2, 2],
      [0, 4, 2],
      [0, 6, 2],
      [1, 0, 2],
      [1, 2, 2],
      [1, 4, 2],
      [1, 6, 2],
    ]);
  });

  it('opens on the first flag, or on the saved country', () => {
    expect(cursorKey(opened(['JP']))).toBe('JP');
    expect(cursorKey(opened(['JP'], 'CH'))).toBe('CH');
    expect(cursorKey(opened([], 'none'))).toBe('FR');
  });

  it('chooses a flag at once, by Confirm or by a tap', () => {
    const confirmed = opened(['JP']);
    expect(confirmed.step(CONFIRM, later())).toBe('chosen');
    expect(confirmed.choice).toBe('JP');
    const tapped = opened();
    expect(pick(tapped, 'CA')).toBe('chosen');
    expect(tapped.choice).toBe('CA');
  });

  it('chooses no country on NONE', () => {
    const choice = opened();
    expect(pick(choice, 'noCountry')).toBe('chosen');
    expect(choice.choice).toBe('none');
  });

  it('cancels on back', () => {
    expect(opened().step(BACK, later())).toBe('cancelled');
  });

  it('never acts on the press that opened it', () => {
    const choice = new CountryChoice();
    const fr = pointOf(opened(), 'FR');
    choice.open(2000, frame({ pressed: Button.Confirm }), [], undefined);
    expect(
      choice.step(frame({ releaseRegion: 'field', releaseX: fr.x, releaseY: fr.y }), 2001),
    ).toBeUndefined();
  });

  it('starts afresh when it opens again after a typed code', () => {
    const choice = onLetters(new CountryChoice(), 'FR');
    choice.open(500, frame(), ['DE'], undefined);
    expect(choice.byLetters).toBe(false);
    expect(shown(choice)[0]).toBe('DE');
    expect(slots(choice)).toBe('--');
    expect(choice.knownCode).toBe('');
  });

  it('forgets NONE when it opens again', () => {
    const choice = opened();
    pick(choice, 'noCountry');
    choice.open(500, frame(), [], undefined);
    expect(pick(choice, 'FR')).toBe('chosen');
    expect(choice.choice).toBe('FR');
  });
});

describe('CountryChoice letters (GDD v0.34 §9.1, ADR-0027 decision 6)', () => {
  it('opens empty on OTHER, the cursor on A', () => {
    const choice = onLetters(new CountryChoice(), '');
    expect(choice.byLetters).toBe(true);
    expect(slots(choice)).toBe('--');
    expect(cursorKey(choice)).toBe('A');
    expect(okShown(choice)).toBe(false);
  });

  it('offers OK only for a complete code of the allowlist', () => {
    const choice = onLetters(new CountryChoice(), 'QQ');
    expect(okShown(choice)).toBe(false); // QQ is not a country
    expect(pick(choice, 'ok')).toBeUndefined();
    choice.step(BACK, later());
    pick(choice, 'A');
    pick(choice, 'Z'); // a third letter is ignored
    expect(slots(choice)).toBe('QA');
    expect(choice.knownCode).toBe('QA');
    expect(pick(choice, 'ok')).toBe('chosen');
    expect(choice.choice).toBe('QA');
  });

  it('chooses no country on its NONE', () => {
    const choice = onLetters(new CountryChoice(), 'F');
    expect(pick(choice, 'noCountry')).toBe('chosen');
    expect(choice.choice).toBe('none');
  });

  it('deletes on back and DEL, then returns to the suggestions on OTHER', () => {
    const choice = onLetters(new CountryChoice(), 'FR');
    expect(choice.step(BACK, later())).toBeUndefined();
    expect(slots(choice)).toBe('F-');
    expect(choice.knownCode).toBe('');
    pick(choice, 'delete');
    expect(slots(choice)).toBe('--');
    expect(choice.step(BACK, later())).toBeUndefined();
    expect(choice.byLetters).toBe(false);
    expect(cursorKey(choice)).toBe('otherCountry');
    expect(choice.step(BACK, later())).toBe('cancelled');
  });
});
