/**
 * Gameplay tuning values of GDD v0.5, kept as data (ADR-0003): code paths read these records,
 * never literals. Values marked *(initial)* in the GDD are tuned in playtests.
 */

/** The fixed timestep runs at 60 Hz (ADR-0002). */
export const STEPS_PER_SECOND = 60;
/** The domain's `dt`, in seconds (ADR-0014). */
export const STEP_SECONDS = 1 / STEPS_PER_SECOND;

/**
 * Converts a GDD duration to whole simulation steps, once, at load. Timers then count steps down
 * by 1: subtracting `dt` in seconds would drift by a step on some intervals (class diagram notes).
 */
export function toSteps(seconds: number): number {
  return Math.round(seconds * STEPS_PER_SECOND);
}

/** The player's ship, GDD §4.1. Positions are the sprite's centre in play-field pixels. */
export const PlayerTuning = {
  /** Pixels per second; keys move at it, the stick and pointers never beyond it. */
  maxSpeed: 150,
  /** Half the 32 px sprite box: also the margin of the clamp to the field. */
  halfSize: 16,
  spawnX: 120,
  /** Fully hidden below the 320 px field. */
  spawnY: 336,
  /** Where the fly-in ends. */
  restY: 272,
  flyInSeconds: 0.5,
  invulnerableSeconds: 1.5,
  blinksPerSecond: 3,
} as const;

/** Spread at power level 1, GDD §4.3. */
export const SpreadLevel1 = {
  shotsPerSecond: 10,
  /** Pixels per second, straight up. */
  speed: 360,
  width: 2,
  height: 8,
  /** The nose is this many pixels above the ship's centre. */
  noseOffset: 16,
  damage: 1,
} as const;

/** Player bullets alive at once at level 1: about 9, so 16 leaves headroom (class diagram). */
export const PLAYER_BULLET_POOL_SIZE = 16;
