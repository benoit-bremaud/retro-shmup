import type { Vec2 } from './geometry';
import { SpreadPattern } from './spread-pattern';
import { KitCaps, SpreadLevel1, toSteps } from './tuning';

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
 * What a weapon fires, as a constant record per weapon and level (ADR-0003: tuning as data).
 * Named fields make a swapped width and height, or damage and pierce, visible at a glance.
 */
export interface ShotSpec {
  /** Pixels per second. */
  readonly vxPerSecond: number;
  readonly vyPerSecond: number;
  readonly width: number;
  readonly height: number;
  readonly damage: number;
  /** How many more bodies the bullet may cross (the Laser's piercing). */
  readonly pierce: number;
}

const COOLDOWN_STEPS = toSteps(1 / SpreadLevel1.shotsPerSecond);

/**
 * The player's weapon. The cooldown counts whole steps and runs whether fire is held or not, so
 * tapping never fires faster than holding (GDD v0.5 §4.3). A run starts with the Spread at level 1.
 * Interim (E-1 → E-2, meta/05-state-scenes): every kind and level fires the level-1 Spread; the
 * look-up in the weapon tables comes with them.
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
   * A P of `kind` caught (GDD v0.8 §4.6): it selects that weapon, keeping the level and the
   * cooldown, and raises the level by one. Returns false at level 5, where the level cannot rise.
   */
  powerUp(kind: WeaponKind): boolean {
    this.currentKind = kind;
    if (this.currentLevel >= KitCaps.maxPower) return false;
    this.currentLevel += 1;
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
    SpreadPattern.fire(origin, spawner);
    this.cooldown = COOLDOWN_STEPS;
  }
}
