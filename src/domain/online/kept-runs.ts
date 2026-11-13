import type { RunStatus } from '../ports/leaderboard-port';
import type { StoragePort } from '../ports/storage-port';

/**
 * The runs sent online, kept so the player can follow and erase them (ADR-0031 decision 17). Each
 * run lives under its own key, `retro-shmup.online.v1.<id>`, never in the save document, so two
 * tabs never overwrite each other's runs (ADR-0032). Values are parsed by allowlist without
 * throwing: an invalid key or value is ignored and never removed (ADR-0006). This module owns the
 * key layout; `OnlineRuns` never builds a key.
 */

/** The key's `v1` is the schema version; a schema change uses a new prefix. */
export const KEPT_RUN_PREFIX = 'retro-shmup.online.v1.';
/** Checked when the player chooses *SEND* only: concurrent tabs may keep more (decision 4). */
export const MAX_KEPT_RUNS = 20;

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

/** Every valid kept run, newest first by id (a ULID sorts by time), with no cap. */
export function readKeptRuns(store: StoragePort): readonly KeptRun[] {
  const keys = store.keys(KEPT_RUN_PREFIX);
  const runs: KeptRun[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    const id = (keys[i] ?? '').slice(KEPT_RUN_PREFIX.length);
    if (!ULID.test(id)) continue;
    const run = parseKeptRun(id, store.read(KEPT_RUN_PREFIX + id));
    if (run !== undefined) runs.push(run);
  }
  return runs.sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** The kept run `id`, read from its own key, or `undefined` when gone or invalid. */
export function readKeptRun(store: StoragePort, id: string): KeptRun | undefined {
  return parseKeptRun(id, store.read(KEPT_RUN_PREFIX + id));
}

/**
 * Keeps an accepted run without checking the limit (decision 4); true when already kept (never
 * overwritten), false when the storage refused it.
 */
export function keepRun(store: StoragePort, run: KeptRun): boolean {
  if (readKeptRun(store, run.id) !== undefined) return true;
  return store.write(KEPT_RUN_PREFIX + run.id, serialize(run));
}

/**
 * Rewrites run `id` with `status` only while its key still holds a valid run, read again just
 * before, so a run another tab erased is not recreated (decision 5).
 */
export function restatusRun(store: StoragePort, id: string, status: RunStatus): boolean {
  const run = readKeptRun(store, id);
  if (run === undefined) return false;
  return store.write(KEPT_RUN_PREFIX + id, serialize({ ...run, status }));
}

/** Removes run `id`'s key: erased, or unknown to the leaderboard. */
export function forgetRun(store: StoragePort, id: string): void {
  store.remove(KEPT_RUN_PREFIX + id);
}

/** The value stored under run `id`'s key, or `undefined` when absent or invalid. */
export function parseKeptRun(id: string, text: string | null): KeptRun | undefined {
  if (text === null) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const token: unknown = own(value, 'token');
  const score: unknown = own(value, 'score');
  const sentAt: unknown = own(value, 'sentAt');
  const status: unknown = own(value, 'status');
  if (!ULID.test(id)) return undefined;
  if (typeof token !== 'string' || !TOKEN.test(token)) return undefined;
  if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0) return undefined;
  if (typeof sentAt !== 'string' || !ISO_DATE.test(sentAt)) return undefined;
  const known = STATUSES.find((candidate) => candidate === status);
  if (known === undefined) return undefined;
  return { id, token, score, sentAt, status: known };
}

/** An own property only: inherited ones are never read from untrusted data. */
function own(value: object, name: string): unknown {
  return Object.hasOwn(value, name) ? Reflect.get(value, name) : undefined;
}

function serialize(run: KeptRun): string {
  const { token, score, sentAt, status } = run;
  return JSON.stringify({ token, score, sentAt, status });
}
