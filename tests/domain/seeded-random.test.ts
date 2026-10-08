import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../src/domain/random/seeded-random';

function take(random: SeededRandom, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) values.push(random.next());
  return values;
}

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(new SeededRandom(42), 100)).toEqual(take(new SeededRandom(42), 100));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(new SeededRandom(1), 10)).not.toEqual(take(new SeededRandom(2), 10));
  });

  it('restarts the sequence when reseeded', () => {
    const random = new SeededRandom(7);
    const first = take(random, 20);
    random.seed(7);
    expect(take(random, 20)).toEqual(first);
  });

  it('returns values in [0, 1)', () => {
    const values = take(new SeededRandom(123), 10_000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it('spreads values evenly enough for drop rolls (30 % and 60 % thresholds)', () => {
    const values = take(new SeededRandom(2026), 20_000);
    const below30 = values.filter((v) => v < 0.3).length / values.length;
    const below60 = values.filter((v) => v < 0.6).length / values.length;
    expect(below30).toBeCloseTo(0.3, 1);
    expect(below60).toBeCloseTo(0.6, 1);
  });

  it('matches the reference xoshiro128** (splitmix32-seeded) sequence for seed 42', () => {
    // Expected values from an independent implementation of the authors' reference C code,
    // itself checked against the published vector for state {1, 2, 3, 4}.
    expect(take(new SeededRandom(42), 5)).toEqual([
      0.6606157226487994, 0.12688010395504534, 0.11170196393504739, 0.8149394164793193,
      0.07910565007477999,
    ]);
  });

  it('accepts seed 0 without degenerating into a constant sequence', () => {
    const values = take(new SeededRandom(0), 10);
    expect(new Set(values).size).toBe(10);
  });
});
