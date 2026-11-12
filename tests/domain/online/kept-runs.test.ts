import { describe, expect, it } from 'vitest';
import {
  KEPT_RUNS_KEY,
  KeptRuns,
  MAX_KEPT_RUNS,
  parseKeptRuns,
  serializeKeptRuns,
} from '../../../src/domain/online/kept-runs';
import type { KeptRun } from '../../../src/domain/online/kept-runs';

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

describe('parseKeptRuns', () => {
  it('reads what serializeKeptRuns wrote', () => {
    const kept = new KeptRuns([keptRun(1), keptRun(2, { status: 'verified' })]);
    expect(parseKeptRuns(serializeKeptRuns(kept)).items).toEqual(kept.items);
  });

  it.each([
    ['absent', null],
    ['not JSON', '{'],
    ['not a document', '[]'],
    ['another version', JSON.stringify({ v: 2, runs: [] })],
    ['runs not a list', JSON.stringify({ v: 1, runs: {} })],
  ])('gives an empty list when %s', (_label, text) => {
    expect(parseKeptRuns(text).items).toEqual([]);
  });

  it.each([
    ['an id that is not a ULID', { id: 'not-a-ulid' }],
    ['an id with a lowercase letter', { id: `01jc${'0'.repeat(22)}` }],
    ['a short token', { token: 'a'.repeat(63) }],
    ['an uppercase token', { token: 'A'.repeat(64) }],
    ['a negative score', { score: -1 }],
    ['a fractional score', { score: 1.5 }],
    ['a date that is not ISO', { sentAt: 'yesterday' }],
    ['an unknown status', { status: 'lost' }],
  ])('drops an item with %s and keeps the others', (_label, fields) => {
    const text = JSON.stringify({ v: 1, runs: [{ ...keptRun(1), ...fields }, keptRun(2)] });
    expect(parseKeptRuns(text).items).toEqual([keptRun(2)]);
  });

  it('drops extra fields and keeps at most the first 20 valid items', () => {
    const runs = Array.from({ length: 25 }, (_, i) => ({ ...keptRun(i), extra: true }));
    const items = parseKeptRuns(JSON.stringify({ v: 1, runs })).items;
    expect(items).toHaveLength(MAX_KEPT_RUNS);
    expect(items[0]).toEqual(keptRun(0));
  });

  it('uses its own storage key, never the save document', () => {
    expect(KEPT_RUNS_KEY).toBe('retro-shmup.online.v1');
  });
});

describe('KeptRuns', () => {
  it('adds a run first and is full at 20, never dropping a token', () => {
    const kept = new KeptRuns([]);
    for (let i = 0; i < MAX_KEPT_RUNS; i += 1) {
      expect(kept.full()).toBe(false);
      expect(kept.add(keptRun(i))).toBe(true);
    }
    expect(kept.items[0]).toEqual(keptRun(MAX_KEPT_RUNS - 1));
    expect(kept.full()).toBe(true);
    expect(kept.add(keptRun(99))).toBe(false);
    expect(kept.items).toHaveLength(MAX_KEPT_RUNS);
  });

  it('sets a status and drops a run by id', () => {
    const kept = new KeptRuns([keptRun(1), keptRun(2)]);
    kept.setStatus(keptRun(2).id, 'rejected');
    kept.drop(keptRun(1).id);
    expect(kept.items).toEqual([keptRun(2, { status: 'rejected' })]);
    kept.setStatus('missing', 'verified');
    kept.drop('missing');
    expect(kept.items).toEqual([keptRun(2, { status: 'rejected' })]);
  });

  it('keeps a run once when it is added again', () => {
    const kept = new KeptRuns([keptRun(1)]);
    expect(kept.add(keptRun(1))).toBe(true);
    expect(kept.items).toEqual([keptRun(1)]);
  });
});
