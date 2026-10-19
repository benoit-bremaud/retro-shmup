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

describe('NameEntry — the name (GDD v0.16 §9.1)', () => {
  it('opens on the name: eight empty slots, the first on the bar', () => {
    const entry = opened();
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
    expect(entry.step(BACK, (clock += 20))).toBeUndefined();
    expect(entry.step(BACK, (clock += 20))).toBeUndefined();
    expect(slots(entry)).toBe('--------');
  });

  it('records nothing on SKIP', () => {
    expect(pick(opened(), 'skip')).toBe('skipped');
  });

  it.each([[[]], [['keySpace', 'keySpace']]])('records nothing on OK with %j', (keys) => {
    const entry = opened();
    typed(entry, ...keys);
    expect(pick(entry, 'ok')).toBe('skipped');
  });

  it('trims the name at both ends on OK and records it with the saved country', () => {
    const entry = opened('FR');
    typed(entry, 'keySpace', 'A', 'keySpace', 'B', 'keySpace');
    expect(pick(entry, 'ok')).toBe('entered');
    expect(entry.entry(DATE)).toEqual({
      name: 'A B',
      country: 'FR',
      score: 5000,
      level: 1,
      date: DATE,
    });
  });

  it.each([undefined, 'none', 'XX'])('records no country for the saved choice %s', (country) => {
    const entry = opened(country);
    typed(entry, 'A');
    expect(pick(entry, 'ok')).toBe('entered');
    expect(entry.entry(DATE)).toEqual({ name: 'A', score: 5000, level: 1, date: DATE });
  });

  it('starts afresh when it opens again', () => {
    const entry = opened('FR');
    typed(entry, 'A', 'B');
    entry.open(500, frame(), 900, undefined);
    expect(slots(entry)).toBe('--------');
    expect(entry.grid.cursor).toBe(0);
  });
});
