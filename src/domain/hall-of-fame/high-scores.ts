import { isRecord } from '../guards';
import { COUNTRY_CODES } from './country-codes';

/** One entry of the hall of fame (ADR-0021 decision 1). */
export interface HighScoreEntry {
  /** 1 to 8 characters of `A`–`Z`, `0`–`9` and space, trimmed; or `???` (ADR-0021 decision 2). */
  readonly name: string;
  /** An ISO 3166-1 alpha-2 code of `COUNTRY_CODES`; absent when none was chosen. */
  readonly country?: string;
  readonly score: number;
  /** The last level played. */
  readonly level: 1 | 2 | 3;
  /** `YYYY-MM-DD`, given by the host (ADR-0006). */
  readonly date: string;
}

/** The table's size (GDD v0.16 §9.1). */
const TABLE_SIZE = 10;

const NAME = /^[A-Z\d ]{1,8}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '???') return true;
  return NAME.test(value) && value.trim() === value;
}

function isLevel(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

/** One stored entry rebuilt from its known fields, or `undefined` (ADR-0021 decision 6). */
function parseEntry(value: unknown): HighScoreEntry | undefined {
  if (!isRecord(value)) return undefined;
  const { name, country, score, level, date } = value;
  if (!isName(name) || !isLevel(level)) return undefined;
  // A score of 0 never enters the table, so none is ever stored.
  if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 1) return undefined;
  if (typeof date !== 'string' || !DATE.test(date)) return undefined;
  if (country === undefined) return { name, score, level, date };
  if (typeof country !== 'string' || !COUNTRY_CODES.has(country)) return undefined;
  return { name, country, score, level, date };
}

/**
 * The stored table (untrusted input, ADR-0006 and ADR-0021 decision 6): every valid entry, best
 * first, at most ten; an invalid entry is dropped, the rest kept; never throws.
 */
export function parseHighScores(value: unknown): HighScoreEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: HighScoreEntry[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const entry = parseEntry(value[i]);
    if (entry !== undefined) entries.push(entry);
  }
  return new HighScoreTable(entries).entries.slice();
}

/**
 * The local top 10 (GDD v0.16 §9.1): best first; a score above 0 enters while the table has room
 * or when strictly above the tenth; at equal scores the new entry goes after the older ones.
 */
export class HighScoreTable {
  private list: HighScoreEntry[];

  /** Best first and ten at most, whatever the order given; a stable sort keeps equal scores' order. */
  constructor(entries: readonly HighScoreEntry[]) {
    this.list = [...entries].sort((a, b) => b.score - a.score).slice(0, TABLE_SIZE);
  }

  get entries(): readonly HighScoreEntry[] {
    return this.list;
  }

  qualifies(score: number): boolean {
    if (score <= 0) return false;
    const last = this.list[TABLE_SIZE - 1];
    return last === undefined || score > last.score;
  }

  /** Inserts a qualifying entry and returns its rank from 0, or −1 when it does not qualify. */
  insert(entry: HighScoreEntry): number {
    if (!this.qualifies(entry.score)) return -1;
    let rank = 0;
    while ((this.list[rank]?.score ?? -1) >= entry.score) rank += 1;
    this.list = [...this.list.slice(0, rank), entry, ...this.list.slice(rank)].slice(0, TABLE_SIZE);
    return rank;
  }
}
