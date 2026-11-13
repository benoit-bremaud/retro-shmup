import { describe, expect, it } from 'vitest';
import {
  forgetRun,
  KEPT_RUN_PREFIX,
  keepRun,
  parseKeptRun,
  readKeptRun,
  readKeptRuns,
  restatusRun,
} from '../../../src/domain/online/kept-runs';
import type { KeptRun } from '../../../src/domain/online/kept-runs';
import { MemoryStore } from '../../support/leaderboard-fakes';

const TOKEN = 'a'.repeat(64);

function keptRun(n: number, fields: Partial<KeptRun> = {}): KeptRun {
  return {
    id: `01JC${String(n).padStart(22, '0')}`,
    token: TOKEN,
    score: 1000 + n,
    sentAt: '2026-11-12T10:00:00.000Z',
    status: 'pending',
    ...fields,
  };
}

function value(run: KeptRun, fields: Record<string, unknown> = {}): string {
  const { token, score, sentAt, status } = run;
  return JSON.stringify({ token, score, sentAt, status, ...fields });
}

describe('kept runs, one storage key per run (ADR-0032)', () => {
  it('keeps each run under its own key, never the save document', () => {
    const store = new MemoryStore();
    expect(keepRun(store, keptRun(1))).toBe(true);
    expect(KEPT_RUN_PREFIX).toBe('retro-shmup.online.v1.');
    expect([...store.values.keys()]).toEqual([`${KEPT_RUN_PREFIX}${keptRun(1).id}`]);
    expect(readKeptRun(store, keptRun(1).id)).toEqual(keptRun(1));
  });

  it('lists every valid run, newest id first, with no cap', () => {
    const store = new MemoryStore();
    for (let i = 0; i < 25; i += 1) keepRun(store, keptRun(i));
    const runs = readKeptRuns(store);
    expect(runs).toHaveLength(25);
    expect(runs[0]).toEqual(keptRun(24));
    expect(runs[24]).toEqual(keptRun(0));
  });

  it('never overwrites a run already kept', () => {
    const store = new MemoryStore();
    keepRun(store, keptRun(1, { status: 'verified' }));
    expect(keepRun(store, keptRun(1))).toBe(true);
    expect(readKeptRun(store, keptRun(1).id)?.status).toBe('verified');
  });

  it('reports a write the storage refused', () => {
    const store = new MemoryStore();
    store.refuse = true;
    expect(keepRun(store, keptRun(1))).toBe(false);
    expect(readKeptRuns(store)).toEqual([]);
  });

  it('rewrites a status only while the key still holds a valid run (decision 5)', () => {
    const store = new MemoryStore();
    keepRun(store, keptRun(1));
    expect(restatusRun(store, keptRun(1).id, 'rejected')).toBe(true);
    expect(readKeptRun(store, keptRun(1).id)?.status).toBe('rejected');
    forgetRun(store, keptRun(1).id);
    expect(restatusRun(store, keptRun(1).id, 'verified')).toBe(false);
    expect(store.values.size).toBe(0);
  });

  it('forgets one run and leaves the others', () => {
    const store = new MemoryStore();
    keepRun(store, keptRun(1));
    keepRun(store, keptRun(2));
    forgetRun(store, keptRun(1).id);
    expect(readKeptRuns(store)).toEqual([keptRun(2)]);
  });

  it('ignores, and never removes, a key whose suffix is not a ULID', () => {
    const store = new MemoryStore();
    store.write(`${KEPT_RUN_PREFIX}not-a-ulid`, value(keptRun(1)));
    store.write('retro-shmup.online.v1', JSON.stringify({ v: 1, runs: [keptRun(1)] }));
    expect(readKeptRuns(store)).toEqual([]);
    expect(store.values.size).toBe(2);
  });

  it.each([
    ['absent', null],
    ['not JSON', '{'],
    ['not an object', '[]'],
    ['null', 'null'],
  ])('reads no run when the value is %s', (_label, text) => {
    expect(parseKeptRun(keptRun(1).id, text)).toBeUndefined();
  });

  it.each([
    ['a short token', { token: 'a'.repeat(63) }],
    ['an uppercase token', { token: 'A'.repeat(64) }],
    ['a negative score', { score: -1 }],
    ['a fractional score', { score: 1.5 }],
    ['a date that is not ISO', { sentAt: 'yesterday' }],
    ['an unknown status', { status: 'lost' }],
  ])('ignores a value with %s and keeps the others', (_label, fields) => {
    const store = new MemoryStore();
    store.write(`${KEPT_RUN_PREFIX}${keptRun(1).id}`, value(keptRun(1), fields));
    keepRun(store, keptRun(2));
    expect(readKeptRuns(store)).toEqual([keptRun(2)]);
    expect(store.values.size).toBe(2);
  });

  it('drops extra fields and never reads an inherited one', () => {
    const run = keptRun(1);
    expect(parseKeptRun(run.id, value(run, { extra: true }))).toEqual(run);
    expect(parseKeptRun(run.id, '{"__proto__":{"status":"verified"}}')).toBeUndefined();
  });
});
