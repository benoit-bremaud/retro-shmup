import type { Vec2 } from './geometry';
import { SpreadLevel1 } from './tuning';
import type { BulletSpawner, ShotSpec } from './weapon';

const LEVEL_1_SHOT: ShotSpec = {
  vxPerSecond: 0,
  vyPerSecond: -SpreadLevel1.speed,
  width: SpreadLevel1.width,
  height: SpreadLevel1.height,
  damage: SpreadLevel1.damage,
  pierce: 0,
};

/**
 * The Spread weapon's shot pattern (class diagram: `WeaponPattern`). Stateless. Only power level 1
 * exists until pickups land; the per-level records then replace the single one.
 */
export const SpreadPattern = {
  fire(origin: Readonly<Vec2>, spawner: BulletSpawner): void {
    spawner.spawnPlayerBullet(origin.x, origin.y - SpreadLevel1.noseOffset, LEVEL_1_SHOT);
  },
} as const;
