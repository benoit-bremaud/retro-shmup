import { describe, expect, it } from 'vitest';
import { JINGLES, runTrack, Track } from '../../src/domain/audio/music';
import { cycleVolume, isVolumeStep, nudgeVolume } from '../../src/domain/audio/volume';
import { BossState } from '../../src/domain/game/boss';

describe('volume steps (GDD v0.23 §9.3)', () => {
  it.each([
    [5, 1, 6],
    [10, 1, 10],
    [0, -1, 0],
    [3, -1, 2],
  ])('nudges %i by %i to %i, held at 0 and 10', (step, direction, expected) => {
    expect(nudgeVolume(step, direction)).toBe(expected);
  });

  it('cycles up by one and wraps from 10 to 0', () => {
    expect([cycleVolume(9), cycleVolume(10)]).toEqual([10, 0]);
  });

  it.each([
    [0, true],
    [10, true],
    [7, true],
    [11, false],
    [-1, false],
    [2.5, false],
    ['5', false],
    [null, false],
  ])('accepts %j as a step: %s', (value, expected) => {
    expect(isVolumeStep(value)).toBe(expected);
  });
});

describe('runTrack (GDD v0.23 §6)', () => {
  it.each([
    [BossState.Idle, Track.Level1],
    [BossState.Warning, null],
    [BossState.Entering, Track.Boss],
    [BossState.Fighting, Track.Boss],
    [BossState.Destroyed, Track.Boss],
  ])('plays %s as %s', (state, track) => {
    expect(runTrack(state)).toBe(track);
  });

  it('has the Results and Game over jingles only', () => {
    expect(JINGLES).toEqual([Track.Results, Track.GameOver]);
  });
});
