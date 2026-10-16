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

/** Left or right on a volume row: one step down or up, held at 0 and 10 (GDD v0.23 §9.3). */
export function nudgeVolume(step: number, direction: number): number {
  return Math.min(MAX_VOLUME_STEP, Math.max(0, step + direction));
}

/** An activation of a volume row: one step up, from 10 back to 0, like every value row. */
export function cycleVolume(step: number): number {
  return step >= MAX_VOLUME_STEP ? 0 : step + 1;
}

/** Whether a stored value is a volume step: an integer from 0 to 10 (ADR-0006 allowlist). */
export function isVolumeStep(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_VOLUME_STEP
  );
}
