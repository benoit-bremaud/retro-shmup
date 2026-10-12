import type { Vec2 } from './geometry';
import { KitCaps, LaserTuning, PlayerTuning, SpreadTuning, toSteps } from './tuning';

/** The two weapons (GDD §4.3), chosen by the colour of the last P caught. */
export const WeaponKind = {
  Spread: 'SPREAD',
  Laser: 'LASER',
} as const;
export type WeaponKind = (typeof WeaponKind)[keyof typeof WeaponKind];

/**
 * Where the player's weapon puts its shots (class diagram). Declared with the weapon code, its
 * client, so the player and the world do not import each other; enemy attacks get their own
 * spawner, so an attack can never fire a player bullet.
 */
export interface PlayerShotSpawner {
  /** A bullet centred on (x, y), shaped by a constant shot record: nothing is allocated per shot. */
  spawnPlayerBullet(x: number, y: number, shot: Readonly<ShotSpec>): void;
}

/**
 * What a weapon fires, as a constant record per weapon and level (ADR-0003, ADR-0019: tuning as
 * data). Named fields make a swapped width and height, or damage and pierce, visible at a glance.
 */
export interface ShotSpec {
  /** Where the shot leaves, from the ship's centre. */
  readonly offsetX: number;
  readonly offsetY: number;
  /** Pixels per second, computed once at load (no trigonometry per step). */
  readonly vxPerSecond: number;
  readonly vyPerSecond: number;
  readonly width: number;
  readonly height: number;
  /** In tenths of a level-1 shot (ADR-0019). */
  readonly damage: number;
  /** How many bodies the bullet passes through before the hit that spends it. */
  readonly pierce: number;
  /** The weapon that fired it: the presenter picks its colour from it, never from its size. */
  readonly weapon: WeaponKind;
}

/** One power level of one weapon: its cooldown in whole steps and the shots of one volley. */
export interface WeaponLevel {
  readonly cooldownSteps: number;
  readonly shots: readonly ShotSpec[];
}

const DEGREES = Math.PI / 180;

/** A Spread bullet along `degrees` from straight up, from the nose (GDD v0.8 §4.3). */
function spreadShot(degrees: number, damage: number): ShotSpec {
  const t = SpreadTuning;
  return {
    offsetX: 0,
    offsetY: -PlayerTuning.noseOffset,
    vxPerSecond: t.speed * Math.sin(degrees * DEGREES),
    vyPerSecond: -t.speed * Math.cos(degrees * DEGREES),
    width: t.width,
    height: t.height,
    damage,
    pierce: 0,
    weapon: WeaponKind.Spread,
  };
}

/** The centre stream, then each side angle mirrored: left first. */
function spreadLevel(
  cooldownSteps: number,
  centreDamage: number,
  sides: readonly number[],
): WeaponLevel {
  const shots = [spreadShot(0, centreDamage)];
  for (let i = 0; i < sides.length; i += 1) {
    const angle = sides[i] ?? 0;
    shots.push(
      spreadShot(-angle, SpreadTuning.sideDamage),
      spreadShot(angle, SpreadTuning.sideDamage),
    );
  }
  return { cooldownSteps, shots };
}

/** A Laser bolt, its lower end at the nose (GDD v0.8 §4.3). */
function laserLevel(width: number, damage: number, pierce: number): WeaponLevel {
  const t = LaserTuning;
  return {
    cooldownSteps: toSteps(1 / t.boltsPerSecond),
    shots: [
      {
        offsetX: 0,
        offsetY: -PlayerTuning.noseOffset - t.boltLength / 2,
        vxPerSecond: 0,
        vyPerSecond: -t.speed,
        width,
        height: t.boltLength,
        damage,
        pierce,
        weapon: WeaponKind.Laser,
      },
    ],
  };
}

const SPREAD_COOLDOWN = toSteps(1 / SpreadTuning.shotsPerSecond);

/**
 * The weapon tables (GDD v0.8 §4.3, ADR-0019), `WEAPONS[kind][level − 1]`, built once at load.
 * Damage in tenths: the centre stream carries the power ratio, side streams add coverage.
 */
export const WEAPONS: Readonly<Record<WeaponKind, readonly WeaponLevel[]>> = {
  [WeaponKind.Spread]: [
    spreadLevel(SPREAD_COOLDOWN, 10, []),
    spreadLevel(SPREAD_COOLDOWN, 14, [6]),
    spreadLevel(SPREAD_COOLDOWN, 19, [12]),
    spreadLevel(SPREAD_COOLDOWN, 24, [6, 14]),
    spreadLevel(toSteps(1 / SpreadTuning.level5ShotsPerSecond), 20, [8, 18]),
  ],
  [WeaponKind.Laser]: [
    laserLevel(2, 10, 1),
    laserLevel(3, 15, 1),
    laserLevel(4, 20, 2),
    laserLevel(6, 25, 2),
    laserLevel(8, 30, 3),
  ],
};

/**
 * The player's weapon. The cooldown counts whole steps and runs whether fire is held or not, so
 * tapping never fires faster than holding (GDD v0.5 §4.3). A run starts with the Spread at level 1;
 * each volley is the `WEAPONS` record of the current kind and level.
 */
export class Weapon {
  private cooldown = 0;
  private currentKind: WeaponKind = WeaponKind.Spread;
  private currentLevel = 1;

  get kind(): WeaponKind {
    return this.currentKind;
  }

  /** The power level, 1 to 5, shared by both weapons (GDD §4.3). */
  get level(): number {
    return this.currentLevel;
  }

  /**
   * A P of `kind` caught (GDD v0.8 §4.6): it selects that weapon, keeping the shared level and the
   * cooldown, then raises the level by one. Returns false at level 5 (the weapon still switches),
   * so the run pays the cap bonus.
   */
  powerUp(kind: WeaponKind): boolean {
    this.currentKind = kind;
    if (this.currentLevel >= KitCaps.maxPower) return false;
    this.currentLevel += 1;
    return true;
  }

  /**
   * A death (GDD v0.8 §4.4): the level drops by one, never below 1, the kind unchanged. Returns
   * whether it dropped, so the run releases the lost level as a P only above level 1.
   */
  powerDown(): boolean {
    if (this.currentLevel <= 1) return false;
    this.currentLevel -= 1;
    return true;
  }

  /** A new ship fires at once (05-state-player, fly-in). */
  reset(): void {
    this.cooldown = 0;
  }

  /** Once per step; `origin` is the ship's centre. The spawner is never stored. */
  tick(origin: Readonly<Vec2>, firing: boolean, spawner: PlayerShotSpawner): void {
    if (this.cooldown > 0) this.cooldown -= 1;
    if (!firing || this.cooldown > 0) return;
    const level = WEAPONS[this.currentKind][this.currentLevel - 1];
    if (level === undefined) return;
    for (let i = 0; i < level.shots.length; i += 1) {
      const shot = level.shots[i];
      if (shot !== undefined) {
        spawner.spawnPlayerBullet(origin.x + shot.offsetX, origin.y + shot.offsetY, shot);
      }
    }
    this.cooldown = level.cooldownSteps;
  }
}
