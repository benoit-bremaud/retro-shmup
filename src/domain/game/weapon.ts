import type { Vec2 } from './geometry';
import { SpreadPattern } from './spread-pattern';
import { SpreadLevel1, toSteps } from './tuning';

/**
 * Where weapons put their shots (class diagram). Declared with the weapon code, its first user,
 * so the player and the world do not import each other. Enemy bullets join with the enemies.
 */
export interface BulletSpawner {
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
 * tapping never fires faster than holding (GDD v0.5 §4.3). While Spread is the only pattern it is
 * called directly; the look-up by weapon kind comes with the Laser.
 */
export class Weapon {
  private cooldown = 0;

  /** Once per step; `origin` is the ship's centre. The spawner is never stored. */
  tick(origin: Readonly<Vec2>, firing: boolean, spawner: BulletSpawner): void {
    if (this.cooldown > 0) this.cooldown -= 1;
    if (!firing || this.cooldown > 0) return;
    SpreadPattern.fire(origin, spawner);
    this.cooldown = COOLDOWN_STEPS;
  }
}
