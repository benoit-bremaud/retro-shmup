import type { RunStatus } from '../ports/leaderboard-port';

/**
 * The runs sent online, kept so the player can follow and erase them (ADR-0031 decision 17). They
 * live under their own key, never in the save document, and are parsed by allowlist without
 * throwing: an invalid item is dropped, the others kept (ADR-0006).
 */

export const KEPT_RUNS_KEY = 'retro-shmup.online.v1';
export const MAX_KEPT_RUNS = 20;
const VERSION = 1;

/** A sent run: the token is the player's own way to erase it. */
export interface KeptRun {
  readonly id: string;
  readonly token: string;
  readonly score: number;
  readonly sentAt: string;
  readonly status: RunStatus;
}

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const STATUSES: readonly RunStatus[] = [
  'pending',
  'verified',
  'rejected',
  'unverifiable',
  'expired',
];

/** The kept runs, newest first, 20 at most. */
export class KeptRuns {
  private list: KeptRun[];

  constructor(items: readonly KeptRun[]) {
    this.list = items.slice(0, MAX_KEPT_RUNS);
  }

  get items(): readonly KeptRun[] {
    return this.list;
  }

  /** With 20 kept, nothing is sent until the player erases one: a token is never dropped. */
  full(): boolean {
    return this.list.length >= MAX_KEPT_RUNS;
  }

  /** Keeps `run` first; false, keeping nothing, when full. */
  add(run: KeptRun): boolean {
    if (this.full()) return false;
    this.list.unshift(run);
    return true;
  }

  setStatus(id: string, status: RunStatus): void {
    this.list = this.list.map((run) => (run.id === id ? { ...run, status } : run));
  }

  drop(id: string): void {
    this.list = this.list.filter((run) => run.id !== id);
  }
}

/** The kept runs stored under `KEPT_RUNS_KEY`; anything unreadable is an empty list. */
export function parseKeptRuns(text: string | null): KeptRuns {
  if (text === null) return new KeptRuns([]);
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return new KeptRuns([]);
  }
  if (typeof document !== 'object' || document === null) return new KeptRuns([]);
  const runs: unknown = Reflect.get(document, 'runs');
  if (Reflect.get(document, 'v') !== VERSION || !Array.isArray(runs)) return new KeptRuns([]);
  const items: KeptRun[] = [];
  for (let i = 0; i < runs.length && items.length < MAX_KEPT_RUNS; i += 1) {
    const run = parseKeptRun(runs[i]);
    if (run !== undefined) items.push(run);
  }
  return new KeptRuns(items);
}

function parseKeptRun(value: unknown): KeptRun | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id: unknown = Reflect.get(value, 'id');
  const token: unknown = Reflect.get(value, 'token');
  const score: unknown = Reflect.get(value, 'score');
  const sentAt: unknown = Reflect.get(value, 'sentAt');
  const status: unknown = Reflect.get(value, 'status');
  if (typeof id !== 'string' || !ULID.test(id)) return undefined;
  if (typeof token !== 'string' || !TOKEN.test(token)) return undefined;
  if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0) return undefined;
  if (typeof sentAt !== 'string' || !ISO_DATE.test(sentAt)) return undefined;
  const known = STATUSES.find((candidate) => candidate === status);
  if (known === undefined) return undefined;
  return { id, token, score, sentAt, status: known };
}

export function serializeKeptRuns(kept: KeptRuns): string {
  return JSON.stringify({ v: VERSION, runs: kept.items });
}
