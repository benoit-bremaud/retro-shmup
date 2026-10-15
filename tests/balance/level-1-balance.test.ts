import { describe, expect, it } from 'vitest';
import { AVERAGE, BEGINNER, GOOD, measureRun } from '../support/average-player';
import type { PlayerProfile, RunMeasure } from '../support/average-player';

// The level-1 balance guard (#56, GDD v0.18 decision record): bots model players, seeded so every
// number replays. `BALANCE_SEEDS=300 BALANCE_REPORT=1 pnpm vitest run tests/balance` prints the
// full report; the bands below hold on the default 100 seeds.
const env: Readonly<Record<string, unknown>> = import.meta.env;
const SEEDS = typeof env.BALANCE_SEEDS === 'string' ? Number(env.BALANCE_SEEDS) : 100;

interface Summary {
  readonly deathsPerRun: number;
  readonly gameOverRate: number;
  readonly bossKillRate: number;
  readonly medianFightS: number;
  readonly medianScore: number;
  readonly medianPower5S: number;
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
    medianPower5S: median(runs.map((m) => m.powerAtS[2] ?? NaN)),
    bombsPerRun: runs.reduce((s, m) => s + m.bombsUsed, 0) / SEEDS,
  };
}

describe('level 1 balance (measurement bot, GDD v0.18)', () => {
  const report = [GOOD, AVERAGE, BEGINNER].map((p) => ({ profile: p.name, ...summarize(p) }));
  if (env.BALANCE_REPORT === '1') console.info(JSON.stringify(report, null, 1));
  const [good, average, beginner] = report;

  // Measured 18 % game over, 82 % boss killed: a good player wins most runs.
  it('lets the good player win most runs', () => {
    expect(good?.gameOverRate).toBeLessThanOrEqual(0.3);
    expect(good?.bossKillRate).toBeGreaterThanOrEqual(0.7);
  });

  // Measured 2.3 deaths, 28 % game over, 73 % boss killed (v0.12: 0.56, 2 %, 98 %).
  it('makes the average player lose lives and sometimes the run', () => {
    expect(average?.deathsPerRun).toBeGreaterThanOrEqual(1.5);
    expect(average?.deathsPerRun).toBeLessThanOrEqual(3);
    expect(average?.gameOverRate).toBeGreaterThanOrEqual(0.15);
    expect(average?.gameOverRate).toBeLessThanOrEqual(0.45);
  });

  // Measured 39 s of the 90 s timer (v0.12: 27 s).
  it('keeps the Cruiser fight between 30 and 50 s for the average player', () => {
    expect(average?.medianFightS).toBeGreaterThanOrEqual(30);
    expect(average?.medianFightS).toBeLessThanOrEqual(50);
  });

  // Measured 118 s: full power only just before the WARNING at 120 s (v0.12: 88 s).
  it('gives full power only near the boss', () => {
    expect(average?.medianPower5S).toBeGreaterThanOrEqual(110);
  });

  // Measured 41 %: the beginner still beats the boss now and then.
  it('leaves the beginner a chance at the boss', () => {
    expect(beginner?.bossKillRate).toBeGreaterThanOrEqual(0.25);
  });
});
