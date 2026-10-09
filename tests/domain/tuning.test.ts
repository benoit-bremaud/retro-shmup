import { describe, expect, it } from 'vitest';
import {
  PlayerTuning,
  SpreadLevel1,
  STEPS_PER_SECOND,
  toSteps,
} from '../../src/domain/game/tuning';

describe('toSteps — GDD seconds to whole simulation steps', () => {
  it.each([
    [0.5, 30],
    [1.5, 90],
    [0.1, 6],
    [0, 0],
  ])('converts %s s to %i steps at 60 steps per second', (seconds, steps) => {
    expect(toSteps(seconds)).toBe(steps);
  });

  it('rounds to the nearest step, so a rate never drifts with floating-point error', () => {
    expect(toSteps(1 / 10)).toBe(6);
    expect(toSteps(1 / 3)).toBe(20);
  });

  it('runs at the 60 Hz of the fixed timestep (ADR-0002)', () => {
    expect(STEPS_PER_SECOND).toBe(60);
  });
});

describe('tuning records — GDD v0.5 initial values', () => {
  it('keeps the ship inside the field: its centre is clamped half a sprite from each edge', () => {
    expect(PlayerTuning.halfSize).toBe(16);
    expect(PlayerTuning.restY + PlayerTuning.halfSize).toBeLessThanOrEqual(320);
  });

  it('starts the fly-in with the sprite fully hidden below the field', () => {
    expect(PlayerTuning.spawnY - PlayerTuning.halfSize).toBeGreaterThanOrEqual(320);
  });

  it('fires Spread level 1 at 10 shots per second, one every 6 steps', () => {
    expect(toSteps(1 / SpreadLevel1.shotsPerSecond)).toBe(6);
  });
});
