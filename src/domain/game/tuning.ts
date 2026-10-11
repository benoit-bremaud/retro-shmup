/**
 * Gameplay tuning values of the GDD, kept as data (ADR-0003): code paths read these records,
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
  /** The full sprite box: pickups are caught with it, generously (GDD §4.6). */
  collectSize: 32,
  /** The death sequence before the next fly-in (GDD §4.4). */
  respawnSeconds: 1.5,
} as const;

/** One level-1 shot in tenths (ADR-0019): HP and damage are whole tenths of it. */
export const L1_SHOT = 10;

/** The Spread (GDD v0.8 §4.3): bullets from the nose; the per-level angles are in `WEAPONS`. */
export const SpreadTuning = {
  shotsPerSecond: 10,
  /** A 4-step cooldown: +50 % (whole steps; GDD v0.8). */
  level5ShotsPerSecond: 15,
  /** Pixels per second, along the stream's angle. */
  speed: 360,
  width: 2,
  height: 8,
  /** The nose is this many pixels above the ship's centre. */
  noseOffset: 16,
  /** Side streams deal one level-1 shot, in tenths. */
  sideDamage: L1_SHOT,
} as const;

/** The Laser (GDD v0.8 §4.3): long bolts, their lower end at the nose. */
export const LaserTuning = {
  boltsPerSecond: 10,
  speed: 600,
  boltLength: 48,
  noseOffset: 16,
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

/**
 * Player bullets alive at once (GDD v0.8 §5.2.1): at Spread level 5, 5 streams × 15/s × about
 * 0.85 s ≈ 64, so 80 leaves headroom.
 */
export const PLAYER_BULLET_POOL_SIZE = 80;

/** Pickups (GDD v0.8 §4.6): fall with a sway that is a closed form of their age, no draw. */
export const PickupTuning = {
  size: 16,
  /** Pixels per second, downward. */
  fallSpeed: 40,
  swayAmplitude: 8,
  swayPeriodSeconds: 2,
  /** The sway axis is clamped so the whole box always stays on the field. */
  minAxisX: 16,
  maxAxisX: 224,
} as const;

/** Pickups on the field at once (GDD v0.8 §4.6); a spawn on a full pool is dropped (ADR-0019). */
export const PICKUP_POOL_SIZE = 8;
/** Popcorn formations alive at once (class diagram, ADR-0019). */
export const FORMATION_POOL_SIZE = 16;

/** Caps of the player kit (GDD v0.8 §4.4, §4.6). */
export const KitCaps = {
  maxPower: 5,
  /** Paid when a pickup's effect cannot apply; never multiplied by the chain. */
  capBonus: 1000,
} as const;
