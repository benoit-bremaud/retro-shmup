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
  /** Shots leave from the nose, this many pixels above the ship's centre (GDD §4.3). */
  noseOffset: 16,
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
  /** The shield ring, 36 × 36: while a charge is held it collides instead of the hitbox (GDD v0.19 §4.4). */
  shieldSize: 36,
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
  /** Side streams deal one level-1 shot, in tenths. */
  sideDamage: L1_SHOT,
} as const;

/** The Laser (GDD v0.8 §4.3): long bolts, their lower end at the nose. */
export const LaserTuning = {
  boltsPerSecond: 10,
  speed: 600,
  boltLength: 48,
} as const;

/** Times of the frozen scenes (GDD §4.4, §9.1); the scene machine converts them with toSteps. */
/**
 * The score's counter stop (GDD v0.16 §8, owner 2026-10-15): the score never goes past the eight
 * digits the HUD and the high scores show, the arcade way.
 */
export const ScoreTuning = {
  counterStop: 99_999_999,
} as const;

export const SceneTuning = {
  countInSeconds: 1,
  gameOverSeconds: 3,
  /** Confirm and taps are ignored this long on Game over and on the title after it (GDD v0.7 §4.4). */
  gameOverLockSeconds: 1,
  /** The Ending card leaves on its own after this long (GDD v0.16 §9.1). */
  endingSeconds: 6,
  /** Confirm and taps are ignored this long on the Ending card (GDD v0.16 §9.1). */
  endingLockSeconds: 1,
  /** The title without input this long shows the attract mode (GDD v0.16 §9.1). */
  attractIdleSeconds: 10,
  /** The attract mode shows the high scores this long, then the title again (GDD v0.16 §9.1). */
  attractSeconds: 6,
} as const;

/**
 * Times of the `Results` scene (GDD v0.10 §8, ADR-0022 decision 9): `Confirm` and taps are ignored
 * for the lock, as on Game over (§4.4); the scene leaves on its own after `autoSeconds`; one tally
 * line appears every `lineSeconds`, the first on entry.
 */
export const ResultsTuning = {
  lockSeconds: 1,
  autoSeconds: 8,
  lineSeconds: 0.5,
} as const;

/** Enemy bullets (GDD v0.6 §5.2.1): never faster than the ship. */
export const EnemyBulletTuning = {
  size: 4,
  /** Pixels per second (GDD v0.18; 75 before). */
  speed: 85,
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

/** Gunner (GDD v0.6 §5.2.1; one aimed bullet every 0.8 s, GDD v0.18). */
export const GunnerTuning = {
  travelSeconds: 1,
  holdSeconds: 3.5,
  leaveSpeed: 60,
  firePeriodSeconds: 0.8,
} as const;

/** Heavy (GDD v0.10 §5.2.1): the Gunner's movement with its own values, a ring or a fan. */
export const HeavyTuning = {
  travelSeconds: 2,
  holdSeconds: 10,
  leaveSpeed: 40,
  volleyPeriodSeconds: 2,
  ringCount: 12,
  ringSpeed: 60,
  /** Turned per volley; with 30° spacing every other volley is offset by 15° (GDD §5.2.1). */
  ringRotateDegrees: 15,
  fanCount: 5,
  fanSpreadDegrees: 15,
  /** GDD v0.18; 75 before. */
  fanSpeed: 85,
} as const;

/** Carrier (GDD v0.8 §5.2.1): a straight horizontal crossing that never stops. */
export const CarrierTuning = {
  speed: 60,
} as const;

/** The chain (GDD §8): a 2 s window, a step every 5 kills, capped at ×8. */
export const ChainTuning = {
  windowSeconds: 2,
  killsPerStep: 5,
  maxMultiplier: 8,
} as const;

/**
 * The end-of-level tally (GDD v0.10 §8, ADR-0022 decision 7): its lines are added to the score
 * flat when the level ends, outside the chain.
 */
export const TallyTuning = {
  /** Per whole formation destroyed, a bomb-completed one included. */
  perFormation: 500,
  /** No bomb used in the level. */
  noBomb: 5000,
  /** No life lost in the level (a shield absorb is not a loss). */
  noMiss: 10000,
  /** Per bomb left when the level ends. */
  perBombLeft: 1000,
} as const;

/** Pools of the enemies brick (GDD v0.6 §5.2.1). */
export const ENEMY_POOL_SIZE = 16;
/**
 * 48 leaves at least 12 slots over the level-1 waves' peak (about 30) and 8 over the Cruiser's
 * phase 2 (40, GDD v0.18), both pinned by the level-simulation test.
 */
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
  /** The death release (GDD v0.8 §4.4): rises linearly, never above this y, then falls slowly. */
  releaseRise: 48,
  releaseRiseSeconds: 0.8,
  releaseTopY: 24,
  releaseFallSpeed: 20,
} as const;

/** Bombs and the shield (GDD v0.8 §4.4, §4.5). */
export const KitTuning = {
  /** The bomb's damage, in tenths: 30 level-1 shots. */
  bombDamage: 300,
  /** The bomb's invulnerability: max(time left, this). */
  bombInvulnerableSeconds: 1,
  /** A shield charge absorbing a hit gives this much invulnerability. */
  shieldInvulnerableSeconds: 0.5,
} as const;

/** Pickups on the field at once (GDD v0.8 §4.6); a spawn on a full pool is dropped (ADR-0019). */
export const PICKUP_POOL_SIZE = 8;
/** Popcorn formations alive at once (class diagram, ADR-0019). */
export const FORMATION_POOL_SIZE = 16;

/** Caps of the player kit (GDD v0.8 §4.4, §4.6). */
export const KitCaps = {
  maxPower: 5,
  maxBombs: 5,
  /** The HUD shows at most 9 lives (GDD §4.4). */
  maxLives: 9,
  /** Paid when a pickup's effect cannot apply; never multiplied by the chain. */
  capBonus: 1000,
} as const;

/** The boss bonus (GDD v0.10 §6, ADR-0023): paid flat on `BOSS_DESTROYED`, never multiplied. */
export const BossTuning = {
  bonus: 10000,
  /** Per whole second left on the timer, the seconds the HUD shows. */
  bonusPerSecond: 100,
} as const;

/**
 * The boss's HUD (GDD v0.10 §9.2, §9.7, initial): the WARNING banner blinks twice in its 3 s, so
 * every half period is 0.75 s, under 3 blinks per second; the bar's tick marks the phase-2
 * threshold of the Cruiser, 66 % of its HP. A later boss with other thresholds will hand its own
 * to the snapshot.
 */
export const BossHudTuning = {
  warningBlinkHalfSeconds: 0.75,
  barTickRatio: 0.66,
} as const;

/** The Cruiser, level 1's boss (GDD v0.10 §6.1; values of v0.18): values in seconds, px and px/s. */
export const CruiserTuning = {
  width: 112,
  height: 48,
  /** 1 800 level-1 shots, in tenths (GDD v0.18 §6.1, ADR-0019). */
  hp: 18_000,
  timeLimitSeconds: 90,
  warningSeconds: 3,
  entryFromY: -24,
  entryToY: 56,
  entrySeconds: 3,
  fleeSpeed: 60,
  destroyedSeconds: 2,
  /** Phase 2 starts at 66 % HP: 11 880 tenths (GDD v0.18). */
  phase2HpThreshold: 11_880,
  phase1: {
    swayAmplitude: 56,
    swayPeriodSeconds: 8,
    volleyPeriodSeconds: 0.9,
    fanCount: 5,
    fanSpreadDegrees: 15,
    fanSpeed: 85,
    ringCount: 12,
    ringSpeed: 60,
  },
  phase2: {
    swayAmplitude: 72,
    swayPeriodSeconds: 6,
    volleyPeriodSeconds: 1.25,
    /** GDD v0.18: 14 (was 16), so phase 2 stays within 40 enemy bullets. */
    ringCount: 14,
    ringSpeed: 60,
    ringRotateDegrees: 11.25,
    tripleCount: 3,
    tripleSpreadDegrees: 15,
    tripleSpeed: 85,
  },
} as const;
