import { describe, expect, it } from 'vitest';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { LETTER_GRID } from '../../src/domain/presentation/menu-layout';
import { NameEntry } from '../../src/domain/scenes/name-entry';

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

const CONFIRM = frame({ pressed: Button.Confirm });
const BACK = frame({ pressed: Button.Back });
const DATE = '2026-10-15';

/** The field point at the middle of the cell showing `key` (a character or an action label). */
function pointOf(entry: NameEntry, key: string): { x: number; y: number } {
  const cell = entry.grid.cells.find((candidate) => (candidate.label ?? candidate.text) === key);
  if (cell === undefined) throw new Error(`no cell ${key}`);
  return {
    x: cell.column * LETTER_GRID.cellWidth + LETTER_GRID.cellWidth / 2,
    y: LETTER_GRID.top + cell.row * LETTER_GRID.cellHeight + LETTER_GRID.cellHeight / 2,
  };
}

/** Steps well apart, past every guard: each test's clock. */
let clock = 1000;

/** Taps the cell showing `key` and releases on it: the grid picks it if it is available. */
function pick(entry: NameEntry, key: string): ReturnType<NameEntry['step']> {
  const { x, y } = pointOf(entry, key);
  clock += 20;
  entry.step(frame({ tapRegion: 'field', tapX: x, tapY: y }), clock);
  return entry.step(frame({ releaseRegion: 'field', releaseX: x, releaseY: y }), clock + 1);
}

/** Hovers the cell showing `key`: the cursor moves onto it. */
function hover(entry: NameEntry, key: string, edit: Partial<IntentFrame> = {}): void {
  const { x, y } = pointOf(entry, key);
  clock += 20;
  entry.step(frame({ hovered: true, hoverX: x, hoverY: y, ...edit }), clock);
}

function typed(entry: NameEntry, ...keys: string[]): void {
  for (const key of keys) pick(entry, key);
}

function opened(country?: string, score = 5000): NameEntry {
  const entry = new NameEntry();
  entry.open(0, frame(), score, country);
  return entry;
}

function slots(entry: NameEntry): string {
  let text = '';
  for (let i = 0; i < entry.slotCount; i += 1) text += entry.slot(i);
  return text;
}

function cursorKey(entry: NameEntry): string {
  const cell = entry.grid.cells[entry.grid.cursor];
  return cell?.label ?? cell?.text ?? '';
}

describe('NameEntry — the name (GDD v0.16 §9.1)', () => {
  it('opens on the name: eight empty slots, the first on the bar', () => {
    const entry = opened();
    expect(entry.stage).toBe('name');
    expect(entry.heading).toBe('yourName');
    expect(slots(entry)).toBe('--------');
    expect(entry.nextSlot).toBe(0);
  });

  it('adds the characters and spaces picked, eight at most', () => {
    const entry = opened();
    typed(entry, 'B', 'O', 'B', 'keySpace', '7', 'A', 'B', 'C', 'D');
    expect(slots(entry)).toBe('BOB 7ABC');
    expect(entry.nextSlot).toBe(-1);
    expect(entry.name).toBe('BOB 7ABC');
  });

  it('adds the highlighted character on Confirm', () => {
    const entry = opened();
    entry.step(CONFIRM, 10);
    expect(slots(entry)).toBe('A-------');
  });

  it('deletes the last character on DEL and on back, which never leaves', () => {
    const entry = opened();
    typed(entry, 'A', 'C', 'E');
    pick(entry, 'delete');
    expect(entry.step(BACK, (clock += 20))).toBeUndefined();
    expect(slots(entry)).toBe('A-------');
    entry.step(BACK, (clock += 20));
    entry.step(BACK, (clock += 20));
    expect(entry.stage).toBe('name');
  });

  it('records nothing on SKIP', () => {
    expect(pick(opened(), 'skip')).toBe('skipped');
  });

  it.each([[[]], [['keySpace', 'keySpace']]])('records nothing on OK with %j', (keys) => {
    const entry = opened();
    typed(entry, ...keys);
    expect(pick(entry, 'ok')).toBe('skipped');
  });

  it('trims the name at both ends on OK, then asks the country', () => {
    const entry = opened();
    typed(entry, 'keySpace', 'A', 'keySpace', 'B', 'keySpace');
    expect(pick(entry, 'ok')).toBeUndefined();
    expect(entry.name).toBe('A B');
    expect(entry.stage).toBe('country');
    expect(entry.heading).toBe('country');
  });
});

describe('NameEntry — the country (GDD v0.16 §9.1, ADR-0021 decision 4)', () => {
  function onCountry(country?: string): NameEntry {
    const entry = opened(country);
    typed(entry, 'A');
    pick(entry, 'ok');
    return entry;
  }

  function okShown(entry: NameEntry): boolean {
    return entry.grid.available(entry.grid.cells.findIndex((cell) => cell.label === 'ok'));
  }

  it('shows the code preselected from the language when known, with OK', () => {
    const entry = onCountry('FR');
    expect(slots(entry)).toBe('FR');
    expect(entry.nextSlot).toBe(-1);
    expect(okShown(entry)).toBe(true);
    expect(pick(entry, 'ok')).toBe('entered');
    expect(entry.entry(DATE)).toEqual({
      name: 'A',
      country: 'FR',
      score: 5000,
      level: 1,
      date: DATE,
    });
  });

  it.each(['XX', 'fr', 'FRA'])('preselects nothing from an unknown code %s', (code) => {
    expect(slots(onCountry(code))).toBe('--');
  });

  it('offers OK only for a complete code of the allowlist', () => {
    const entry = onCountry();
    typed(entry, 'Q');
    expect(okShown(entry)).toBe(false);
    typed(entry, 'Q');
    expect(okShown(entry)).toBe(false); // QQ is not a country
    expect(pick(entry, 'ok')).toBeUndefined();
    entry.step(BACK, (clock += 20));
    typed(entry, 'A', 'Z'); // QA, then a third letter ignored
    expect(slots(entry)).toBe('QA');
    expect(okShown(entry)).toBe(true);
    entry.step(BACK, (clock += 20)); // the ignored Z was never stored
    expect(slots(entry)).toBe('Q-');
  });

  it('stores no country on NONE', () => {
    const entry = onCountry('FR');
    expect(pick(entry, 'noCountry')).toBe('entered');
    expect(entry.entry(DATE)).toEqual({ name: 'A', score: 5000, level: 1, date: DATE });
  });

  it('deletes on back and DEL without leaving, hiding OK again', () => {
    const entry = onCountry('FR');
    hover(entry, 'ok');
    expect(cursorKey(entry)).toBe('ok');
    expect(entry.step(BACK, (clock += 20))).toBeUndefined();
    expect(slots(entry)).toBe('F-');
    expect(okShown(entry)).toBe(false);
    expect(cursorKey(entry)).toBe('noCountry'); // moved off OK
    pick(entry, 'delete');
    entry.step(BACK, (clock += 20));
    expect(entry.stage).toBe('country');
    expect(slots(entry)).toBe('--');
  });

  it('never acts on the press that opened the country step', () => {
    const entry = opened();
    typed(entry, 'A');
    hover(entry, 'ok');
    const a = pointOf(entry, 'A');
    entry.step(frame({ pressed: Button.Confirm, tapRegion: 'field', tapX: a.x, tapY: a.y }), 2000);
    expect(entry.stage).toBe('country');
    // The release of the tap that confirmed the name lands on A: it adds nothing.
    entry.step(frame({ releaseRegion: 'field', releaseX: a.x, releaseY: a.y }), 2001);
    expect(slots(entry)).toBe('--');
  });

  it('counts a direction held while the country step opens as held', () => {
    const entry = opened();
    typed(entry, 'A');
    const down = { moveKind: 'direction', moveY: 1 } as const;
    hover(entry, 'ok', down); // the cursor moves down, then onto OK under the mouse
    entry.step(frame({ pressed: Button.Confirm, ...down }), (clock += 20));
    expect(entry.stage).toBe('country');
    entry.step(frame(down), (clock += 1));
    expect(entry.grid.cursor).toBe(0);
  });

  it('opens the country step on OK when a known code is preselected, else on A', () => {
    const preset = onCountry('FR');
    expect(cursorKey(preset)).toBe('ok');
    expect(preset.step(CONFIRM, (clock += 20))).toBe('entered');
    expect(cursorKey(onCountry())).toBe('A');
  });

  it('starts afresh when it opens again', () => {
    const entry = onCountry('FR');
    pick(entry, 'noCountry');
    entry.open(500, frame(), 900, undefined);
    expect(entry.stage).toBe('name');
    expect(slots(entry)).toBe('--------');
    expect(entry.grid.cursor).toBe(0);
  });
});
