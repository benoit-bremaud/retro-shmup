import { describe, expect, it } from 'vitest';
import { PlayerTuning, SpreadTuning, toSteps } from '../../src/domain/game/tuning';

describe('toSteps — GDD seconds to whole simulation steps', () => {
  it.each([
    [0.5, 30],
    [1.5, 90],
    [0, 0],
  ])('converts %s s to %i steps at 60 steps per second', (seconds, steps) => {
    expect(toSteps(seconds)).toBe(steps);
  });

  it('rounds to the nearest step, so a rate never drifts with floating-point error', () => {
    expect(toSteps(1 / 3)).toBe(20);
  });
});

describe('tuning records — GDD v0.5 initial values', () => {
  it('puts the resting point fully inside the field', () => {
    expect(PlayerTuning.halfSize).toBe(16);
    expect(PlayerTuning.restY + PlayerTuning.halfSize).toBeLessThanOrEqual(320);
  });

  it('starts the fly-in with the sprite fully hidden below the field', () => {
    expect(PlayerTuning.spawnY - PlayerTuning.halfSize).toBeGreaterThanOrEqual(320);
  });

  it('fires the Spread at 10 shots per second, one every 6 steps, and 15/s (4 steps) at level 5', () => {
    expect(toSteps(1 / SpreadTuning.shotsPerSecond)).toBe(6);
    expect(toSteps(1 / SpreadTuning.level5ShotsPerSecond)).toBe(4);
  });
});
