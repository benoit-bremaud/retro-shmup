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
  readonly medianEmptyS: number;
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
    medianEmptyS: median(runs.map((m) => m.emptyS)),
  };
}

describe('level 1 balance (measurement bot, GDD v0.21)', () => {
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

  // Measured 98 % game over, 2 % boss killed since a death resets the weapon (GDD v0.29, #130; the
  // owner accepted the harder level, compensation after the playtest; v0.24: 60 %, 40 %).
  it('lets the good player reach and sometimes beat the boss', () => {
    expect(good.gameOverRate).toBeLessThanOrEqual(0.99);
    expect(good.bossKillRate).toBeGreaterThanOrEqual(0.01);
  });

  // Measured 3.91 deaths, 98 % game over with the weapon reset at death (GDD v0.29, #130); 3.32,
  // 61 %, 40 % boss killed with the 6 × 6 hitbox (GDD v0.24, #106); 2.96, 47 %, 53 % with the v0.21 filler rows (v0.19: 2.74,
  // 45 %, 55 %, the ring breaks on near misses; v0.18: 2.3, 28 %, 73 %; v0.12: 0.56, 2 %, 98 %).
  it('makes the average player lose lives and sometimes the run', () => {
    expect(average.deathsPerRun).toBeGreaterThanOrEqual(1.5);
    expect(average.deathsPerRun).toBeLessThanOrEqual(4.2);
    expect(average.gameOverRate).toBeGreaterThanOrEqual(0.5);
    expect(average.gameOverRate).toBeLessThanOrEqual(0.99);
  });

  // Measured 39 s from the WARNING (3 s warning and 3 s entry included), of a 90 s timer; only the
  // runs that kill the boss count, the kill rate being guarded above (v0.12: 27 s).
  it('keeps the Cruiser fight between 30 and 50 s for the average player', () => {
    expect(average.medianFightS).toBeGreaterThanOrEqual(30);
    expect(average.medianFightS).toBeLessThanOrEqual(50);
  });

  // Measured 118 s: full power only just before the WARNING at 120 s (v0.12: 88 s).
  it('gives full power only near the boss', () => {
    // Measured 35 % since the death reset (GDD v0.29, #130; v0.24: 54 %): a Gunner P is needed.
    expect(average.fullPowerRate).toBeGreaterThanOrEqual(0.25);
    expect(average.medianFullPowerS).toBeGreaterThanOrEqual(110);
  });

  // GDD v0.21 §7.2.3: measured 65 s without an enemy in the first 116 s (v0.20: 83 s), so a later
  // edit cannot empty the level again.
  it('keeps the field busy: at most 70 s without an enemy before the calm', () => {
    expect(average.medianEmptyS).toBeLessThanOrEqual(70);
  });

  // Measured 0 % since the death reset (GDD v0.29, #130; v0.24: 3 %; v0.19: 13 %): the beginner does
  // not beat the boss, and still gets past the waves to full power sometimes (measured 11 %).
  it("keeps the boss out of the beginner's reach but not full power", () => {
    expect(beginner.bossKillRate).toBeLessThanOrEqual(0.05);
    expect(beginner.fullPowerRate).toBeGreaterThanOrEqual(0.05);
  });
});
