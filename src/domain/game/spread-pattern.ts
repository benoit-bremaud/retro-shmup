import type { Vec2 } from './geometry';
import { SpreadLevel1 } from './tuning';
import type { BulletSpawner } from './weapon';

/**
 * The Spread weapon's shot pattern (class diagram: `WeaponPattern`). Stateless. Only power level 1
 * exists until pickups land; the per-level records then replace the single one.
 */
export const SpreadPattern = {
  fire(origin: Readonly<Vec2>, spawner: BulletSpawner): void {
    spawner.spawnPlayerBullet(
      origin.x,
      origin.y - SpreadLevel1.noseOffset,
      0,
      -SpreadLevel1.speed,
      SpreadLevel1.width,
      SpreadLevel1.height,
      SpreadLevel1.damage,
      0,
    );
  },
} as const;
