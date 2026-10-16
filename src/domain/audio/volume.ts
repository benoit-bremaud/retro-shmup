/** The highest volume step of the options (GDD v0.23 §9.3). */
export const MAX_VOLUME_STEP = 10;

/** The defaults of a first launch *(initial)*: music 7, sound effects 8 (GDD v0.23 §9.3). */
export const DefaultVolume = {
  music: 7,
  sfx: 8,
} as const;

/** A step from 0 to 10 as a linear gain: (step / 10)², closer to heard loudness than a line. */
export function volumeGain(step: number): number {
  const ratio = step / MAX_VOLUME_STEP;
  return ratio * ratio;
}
