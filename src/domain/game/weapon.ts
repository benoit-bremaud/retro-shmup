import type { Vec2 } from './geometry';
import { SpreadPattern } from './spread-pattern';
import { SpreadLevel1, toSteps } from './tuning';

/**
 * Where weapons put their shots (class diagram). Declared with the weapon code, its first user,
 * so the player and the world do not import each other. Enemy bullets join with the enemies.
 */
export interface BulletSpawner {
  /** Velocities in pixels per second; `pierce` is how many more bodies the bullet may cross. */
  spawnPlayerBullet(
    x: number,
    y: number,
    vxPerSecond: number,
    vyPerSecond: number,
    width: number,
    height: number,
    damage: number,
    pierce: number,
  ): void;
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
