import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from '../../src/domain/hall-of-fame/country-codes';
import { HighScoreTable, parseHighScores } from '../../src/domain/hall-of-fame/high-scores';
import type { HighScoreEntry } from '../../src/domain/hall-of-fame/high-scores';

function entry(name: string, score: number, country?: string): HighScoreEntry {
  return {
    name,
    score,
    level: 1,
    date: '2026-10-14',
    ...(country === undefined ? {} : { country }),
  };
}

describe('COUNTRY_CODES (ADR-0021 decision 3)', () => {
  it('holds the 249 officially assigned ISO 3166-1 alpha-2 codes', () => {
    expect(COUNTRY_CODES.size).toBe(249);
    expect(COUNTRY_CODES.has('FR')).toBe(true);
    expect(COUNTRY_CODES.has('BE')).toBe(true);
    expect(COUNTRY_CODES.has('XK')).toBe(false); // user-assigned
    expect(COUNTRY_CODES.has('ZZ')).toBe(false);
  });
});

describe('HighScoreTable (GDD v0.16 §9.1)', () => {
  it('lets any score above 0 in while the table has fewer than ten entries, never 0', () => {
    const table = new HighScoreTable([]);
    expect(table.qualifies(1)).toBe(true);
    expect(table.qualifies(0)).toBe(false);
  });

  it('keeps ten entries, best first, a score entering only strictly above the tenth', () => {
    const table = new HighScoreTable([]);
    for (let i = 1; i <= 10; i += 1) table.insert(entry(`P${String(i)}`, i * 100));
    expect(table.entries.map((each) => each.score)).toEqual([
      1000, 900, 800, 700, 600, 500, 400, 300, 200, 100,
    ]);
    expect(table.qualifies(100)).toBe(false);
    expect(table.qualifies(101)).toBe(true);
    expect(table.insert(entry('NEW', 550))).toBe(5);
    expect(table.entries).toHaveLength(10);
    expect(table.entries.at(-1)?.score).toBe(200);
  });

  it('puts a new entry after the older ones of the same score', () => {
    const table = new HighScoreTable([entry('OLD', 500)]);
    expect(table.insert(entry('NEW', 500))).toBe(1);
    expect(table.entries.map((each) => each.name)).toEqual(['OLD', 'NEW']);
  });

  it('refuses a score equal to the tenth of a full table', () => {
    const table = new HighScoreTable([]);
    for (let i = 1; i <= 10; i += 1) table.insert(entry(`P${String(i)}`, i * 100));
    expect(table.insert(entry('TIE', 100))).toBe(-1);
  });

  it('sorts and caps whatever it is given', () => {
    const given = Array.from({ length: 12 }, (_, i) => entry(`P${String(i)}`, i + 1));
    const table = new HighScoreTable(given);
    expect(table.entries).toHaveLength(10);
    expect(table.entries[0]?.score).toBe(12);
  });

  it('refuses an entry that does not qualify', () => {
    const table = new HighScoreTable([]);
    expect(table.insert(entry('ZERO', 0))).toBe(-1);
    expect(table.entries).toEqual([]);
  });
});

describe('parseHighScores (ADR-0021 decisions 2, 3 and 6; untrusted input)', () => {
  it('keeps valid entries, best first, at most ten', () => {
    const stored = Array.from({ length: 12 }, (_, i) => entry(`P${String(i)}`, (i + 1) * 10, 'FR'));
    const parsed = parseHighScores(stored);
    expect(parsed).toHaveLength(10);
    expect(parsed[0]).toEqual(entry('P11', 120, 'FR'));
  });

  it.each([
    ['a lowercase name', { ...entry('ace', 10) }],
    ['a name of 9 characters', { ...entry('ABCDEFGHI', 10) }],
    ['a name of spaces', { ...entry('   ', 10) }],
    ['a name with a dash', { ...entry('A-B', 10) }],
    ['an unknown country', { ...entry('ACE', 10, 'ZZ') }],
    ['a lowercase country', { ...entry('ACE', 10, 'fr') }],
    ['a negative score', { ...entry('ACE', -5) }],
    ['a score of 0', { ...entry('ACE', 0) }],
    ['a fractional score', { ...entry('ACE', 1.5) }],
    ['level 4', { ...entry('ACE', 10), level: 4 }],
    ['a bad date', { ...entry('ACE', 10), date: '14/10/2026' }],
    ['a non-object', 'ACE'],
  ])('drops an entry with %s and keeps the others', (_label, bad) => {
    expect(parseHighScores([bad, entry('KEEP', 5)])).toEqual([entry('KEEP', 5)]);
  });

  it('keeps the stored order of equal scores: the older first', () => {
    expect(parseHighScores([entry('A', 5), entry('B', 5)]).map((each) => each.name)).toEqual([
      'A',
      'B',
    ]);
  });

  it('never lets a "__proto__" key reach an entry prototype', () => {
    const stored: unknown = JSON.parse(
      '[{"__proto__":{"name":"X"},"name":"ACE","score":10,"level":1,"date":"2026-10-14"}]',
    );
    const [parsed] = parseHighScores(stored);
    expect(parsed).toEqual(entry('ACE', 10));
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  it.each(['2026-02-28', '2024-02-29', '2000-02-29', '2026-12-31', '2026-04-30'])(
    'accepts the real calendar date %s',
    (date) => {
      expect(parseHighScores([{ ...entry('ACE', 10), date }])).toHaveLength(1);
    },
  );

  it.each([
    '2026-02-29',
    '2100-02-29',
    '2026-02-31',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-99-99',
  ])('drops the impossible date %s (Codex review, PR #67)', (date) => {
    expect(parseHighScores([{ ...entry('ACE', 10), date }])).toEqual([]);
  });

  it('accepts ??? and a name with an inner space', () => {
    expect(parseHighScores([entry('???', 3), entry('BIG BOB', 2)])).toHaveLength(2);
  });

  it('keeps only the known fields, and never throws', () => {
    const parsed = parseHighScores([{ ...entry('ACE', 10, 'FR'), extra: '<script>' }]);
    expect(parsed).toEqual([entry('ACE', 10, 'FR')]);
    expect(parseHighScores('nonsense')).toEqual([]);
    expect(parseHighScores(undefined)).toEqual([]);
  });
});
