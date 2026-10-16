import { beforeAll, describe, expect, it } from 'vitest';
import { AVERAGE, BEGINNER, GOOD, measureRun } from '../support/average-player';
import type { PlayerProfile, RunMeasure } from '../support/average-player';

// The level-1 balance guard (#56, GDD v0.18 decision record): bots model players, seeded so every
// number replays. `BALANCE_SEEDS=300 BALANCE_REPORT=1 pnpm vitest run tests/balance` prints the
// full report; the bands below hold on the default 100 seeds.
const env: Readonly<Record<string, unknown>> = import.meta.env;
const parsedSeeds = Number(env.BALANCE_SEEDS);
const SEEDS = Number.isInteger(parsedSeeds) && parsedSeeds > 0 ? parsedSeeds : 100;

interface Summary {
  readonly deathsPerRun: number;
  readonly gameOverRate: number;
  readonly bossKillRate: number;
  readonly medianFightS: number;
  readonly medianScore: number;
  readonly fullPowerRate: number;
  readonly medianFullPowerS: number;
  readonly bombsPerRun: number;
}

function median(values: number[]): number {
  const kept = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  return kept.length === 0 ? NaN : (kept[Math.floor(kept.length / 2)] ?? NaN);
}

function summarize(profile: PlayerProfile): Summary {
  const runs: RunMeasure[] = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) runs.push(measureRun(profile, seed));
  const share = (test: (m: RunMeasure) => boolean): number => runs.filter(test).length / SEEDS;
  return {
    deathsPerRun: runs.reduce((s, m) => s + m.deaths, 0) / SEEDS,
    gameOverRate: share((m) => m.gameOver),
    bossKillRate: share((m) => m.bossKilled),
    medianFightS: median(runs.map((m) => m.bossFightS)),
    medianScore: median(runs.map((m) => m.score)),
    fullPowerRate: share((m) => !Number.isNaN(m.fullPowerS)),
    medianFullPowerS: median(runs.map((m) => m.fullPowerS)),
    bombsPerRun: runs.reduce((s, m) => s + m.bombsUsed, 0) / SEEDS,
  };
}

describe('level 1 balance (measurement bot, GDD v0.19)', () => {
  // 300 full runs: played once, before the assertions, inside the hook's own timeout.
  let good: Summary;
  let average: Summary;
  let beginner: Summary;
  beforeAll(() => {
    good = summarize(GOOD);
    average = summarize(AVERAGE);
    beginner = summarize(BEGINNER);
    if (env.BALANCE_REPORT === '1')
      console.info(JSON.stringify({ good, average, beginner }, null, 1));
  }, 120_000);

  // Measured 37 % game over, 64 % boss killed since the shield ring collides (v0.19; v0.18: 18 %,
  // 82 %): a good player still wins most runs.
  it('lets the good player win most runs', () => {
    expect(good.gameOverRate).toBeLessThanOrEqual(0.45);
    expect(good.bossKillRate).toBeGreaterThanOrEqual(0.55);
  });

  // Measured 2.74 deaths, 45 % game over, 55 % boss killed (v0.19, the ring breaks on near misses;
  // v0.18: 2.3, 28 %, 73 %; v0.12: 0.56, 2 %, 98 %).
  it('makes the average player lose lives and sometimes the run', () => {
    expect(average.deathsPerRun).toBeGreaterThanOrEqual(1.5);
    expect(average.deathsPerRun).toBeLessThanOrEqual(3);
    expect(average.gameOverRate).toBeGreaterThanOrEqual(0.15);
    expect(average.gameOverRate).toBeLessThanOrEqual(0.5);
  });

  // Measured 39 s from the WARNING (3 s warning and 3 s entry included), of a 90 s timer; only the
  // runs that kill the boss count, the kill rate being guarded above (v0.12: 27 s).
  it('keeps the Cruiser fight between 30 and 50 s for the average player', () => {
    expect(average.medianFightS).toBeGreaterThanOrEqual(30);
    expect(average.medianFightS).toBeLessThanOrEqual(50);
  });

  // Measured 118 s: full power only just before the WARNING at 120 s (v0.12: 88 s).
  it('gives full power only near the boss', () => {
    expect(average.fullPowerRate).toBeGreaterThanOrEqual(0.4); // measured 54 %: a Gunner P is needed
    expect(average.medianFullPowerS).toBeGreaterThanOrEqual(110);
  });

  // Measured 13 % (v0.19; v0.18: 41 %): the beginner still beats the boss now and then.
  it('leaves the beginner a chance at the boss', () => {
    expect(beginner.bossKillRate).toBeGreaterThanOrEqual(0.1);
  });
});
