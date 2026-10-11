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
  /** The 4 × 4 hitbox centred on the ship (GDD §4.1): only it counts for hits. */
  hitboxSize: 4,
  /** Lives at the start of a run, the ship in play included (GDD §4.4). */
  lives: 3,
  /** The death sequence before the next fly-in (GDD §4.4). */
  respawnSeconds: 1.5,
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

/** Times of the frozen scenes (GDD §4.4, §9.1); the scene machine converts them with toSteps. */
export const SceneTuning = {
  countInSeconds: 1,
  gameOverSeconds: 3,
  /** Confirm and taps are ignored this long on Game over and on the title after it (GDD v0.7 §4.4). */
  gameOverLockSeconds: 1,
} as const;

/** Enemy bullets (GDD v0.6 §5.2.1): never faster than the ship. */
export const EnemyBulletTuning = {
  size: 4,
  /** Pixels per second. */
  speed: 75,
  damage: 1,
} as const;

/** Popcorn S curve (GDD v0.6 §5.2.1): x = x0 ± amplitude · sin(2π · y / wavelength). */
export const PopcornTuning = {
  /** Pixels per second, downward. */
  speed: 70,
  amplitude: 40,
  wavelength: 160,
} as const;

/** Diver (GDD v0.6 §5.2.1). */
export const DiverTuning = {
  entrySpeed: 60,
  entrySeconds: 1,
  diveSpeed: 180,
} as const;

/** Gunner (GDD v0.6 §5.2.1). */
export const GunnerTuning = {
  travelSeconds: 1,
  holdSeconds: 3.5,
  leaveSpeed: 60,
  firePeriodSeconds: 1.5,
} as const;

/** The chain (GDD §8): a 2 s window, a step every 5 kills, capped at ×8. */
export const ChainTuning = {
  windowSeconds: 2,
  killsPerStep: 5,
  maxMultiplier: 8,
} as const;

/** Pools of the enemies brick (GDD v0.6 §5.2.1). */
export const ENEMY_POOL_SIZE = 16;
export const ENEMY_BULLET_POOL_SIZE = 48;

/** Player bullets alive at once at level 1: about 9, so 16 leaves headroom (class diagram). */
export const PLAYER_BULLET_POOL_SIZE = 16;
