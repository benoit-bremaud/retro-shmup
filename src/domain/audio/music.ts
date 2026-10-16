import { BossState } from '../game/boss';
import type { TrackId } from '../ports/audio-port';

/** The slice's music tracks (GDD v0.23 §9.5): SketchyLogic's *NES Shooter Music*, CC0. */
export const Track = {
  Title: 'title',
  Level1: 'level-1',
  /** Its intro once, then its loop. */
  Boss: 'boss',
  /** The two jingles, played once. */
  Results: 'results',
  GameOver: 'game-over',
} as const satisfies Record<string, TrackId>;
export type Track = (typeof Track)[keyof typeof Track];

/** The jingles: played once, never looped. */
export const JINGLES: readonly Track[] = [Track.Results, Track.GameOver];

/**
 * The run's track by its boss (GDD v0.23 §6): level 1's until the WARNING, silence through it
 * (the adapter fades the level out over 0.5 s), the boss track from its entrance on.
 */
export function runTrack(boss: BossState): Track | null {
  if (boss === BossState.Idle) return Track.Level1;
  return boss === BossState.Warning ? null : Track.Boss;
}
