import { describe, expect, it } from 'vitest';
import { PickupKind } from '../../src/domain/game/pickup';
import { DIVER, POPCORN } from '../../src/domain/game/enemy';
import {
  ENEMY_BULLET_POOL_SIZE,
  ENEMY_POOL_SIZE,
  PLAYER_BULLET_POOL_SIZE,
} from '../../src/domain/game/tuning';
import { WeaponKind } from '../../src/domain/game/weapon';
import type { ShotSpec } from '../../src/domain/game/weapon';
import { World } from '../../src/domain/game/world';
import { shots } from '../support/shots';

const DT = 1 / 60;

const SHOT: ShotSpec = {
  offsetX: 0,
  offsetY: 0,
  vxPerSecond: 0,
  vyPerSecond: -360,
  width: 2,
  height: 8,
  damage: shots(1),
  pierce: 0,
  weapon: WeaponKind.Spread,
};

function spawnAt(world: World, x: number, y: number): void {
  world.spawnPlayerBullet(x, y, SHOT);
}

function ys(world: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < world.playerBullets.count; i += 1) {
    out.push(world.playerBullets.at(i).position.y);
  }
  return out;
}

describe('World — player bullets (class diagram notes, GDD v0.5 §4.3)', () => {
  it('spawns a bullet with both positions equal, so it never smears', () => {
    const world = new World();
    spawnAt(world, 100, 200);
    const bullet = world.playerBullets.at(0);
    expect(world.playerBullets.count).toBe(1);
    expect(bullet.position).toEqual({ x: 100, y: 200 });
    expect(bullet.previousPosition).toEqual({ x: 100, y: 200 });
  });

  it('moves bullets by their velocity in px/s times dt and keeps the previous position', () => {
    const world = new World();
    spawnAt(world, 100, 200);
    world.moveBullets(DT);
    expect(world.playerBullets.at(0).position.y).toBeCloseTo(194, 9);
    expect(world.playerBullets.at(0).previousPosition.y).toBe(200);
  });

  it('releases a bullet once it is fully above the field, and only then', () => {
    const world = new World();
    spawnAt(world, 100, -3.5); // centre above the field, bottom 0.5 px still visible
    world.sweep();
    expect(world.playerBullets.count).toBe(1);
    spawnAt(world, 100, -4); // bottom edge exactly on the top of the field
    world.sweep();
    expect(ys(world)).toEqual([-3.5]);
  });

  it('drops a shot when the pool is empty, without allocating', () => {
    const world = new World();
    for (let i = 0; i < PLAYER_BULLET_POOL_SIZE + 3; i += 1) spawnAt(world, 100, 200);
    expect(world.playerBullets.count).toBe(PLAYER_BULLET_POOL_SIZE);
  });

  it('removes several bullets in one pass and keeps every other one', () => {
    const world = new World();
    spawnAt(world, 100, -10);
    spawnAt(world, 100, 50);
    spawnAt(world, 100, -20);
    spawnAt(world, 100, 60);
    world.sweep();
    expect(ys(world).sort((a, b) => a - b)).toEqual([50, 60]);
  });

  it('reuses a released bullet for the next shot', () => {
    const world = new World();
    for (let i = 0; i < PLAYER_BULLET_POOL_SIZE; i += 1) spawnAt(world, 100, -10);
    world.sweep();
    spawnAt(world, 100, 200);
    expect(ys(world)).toEqual([200]);
  });
});

const POPCORN_ROW = { at: 0, archetype: POPCORN, count: 1, spawn: { x: 80, y: -8 } };

describe('World — enemies and enemy bullets (GDD v0.6 §5.2.1, class diagram notes)', () => {
  it('drops an enemy refused by a full pool, without consuming a serial', () => {
    const world = new World();
    for (let i = 0; i < ENEMY_POOL_SIZE + 2; i += 1) world.spawnEnemy(POPCORN_ROW, undefined);
    expect(world.enemies.count).toBe(ENEMY_POOL_SIZE);
    world.enemies.at(0).spent = true;
    world.sweep();
    world.spawnEnemy(POPCORN_ROW, undefined);
    expect(world.enemies.at(world.enemies.count - 1).serial).toBe(ENEMY_POOL_SIZE + 1);
  });

  it('caps enemy bullets at 48 and drops the next request without allocating', () => {
    const world = new World();
    for (let i = 0; i < ENEMY_BULLET_POOL_SIZE + 1; i += 1) world.spawnEnemyBullet(100, 100, 0, 75);
    expect(world.enemyBullets.count).toBe(ENEMY_BULLET_POOL_SIZE);
  });

  it('places a spawned Popcorn on its curve at once, with no smear', () => {
    const world = new World();
    world.spawnEnemy(POPCORN_ROW, undefined);
    const popcorn = world.enemies.at(0);
    expect(popcorn.position.x).not.toBe(80); // the curve at y −8 is off its axis
    expect(popcorn.previousPosition).toEqual(popcorn.position);
  });

  it('keeps an enemy that spawns outside the field, then despawns it once it has left', () => {
    const world = new World();
    world.spawnEnemy({ at: 0, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } }, undefined);
    world.sweep();
    expect(world.enemies.count).toBe(1);
    for (let i = 0; i < 400 && world.enemies.count > 0; i += 1) {
      world.moveEnemies(DT);
      world.sweep();
    }
    expect(world.enemies.count).toBe(0);
  });

  it('releases spent bullets and enemies at the sweep', () => {
    const world = new World();
    spawnAt(world, 100, 200);
    world.spawnEnemyBullet(100, 100, 0, 75);
    world.spawnEnemy(POPCORN_ROW, undefined);
    world.playerBullets.at(0).spent = true;
    world.enemyBullets.at(0).spent = true;
    world.enemies.at(0).spent = true;
    world.sweep();
    expect([world.playerBullets.count, world.enemyBullets.count, world.enemies.count]).toEqual([
      0, 0, 0,
    ]);
  });
});

describe('World — Game over (GDD v0.6 §4.4)', () => {
  it('spends every player bullet, released at the next sweep', () => {
    const world = new World();
    spawnAt(world, 100, 200);
    spawnAt(world, 120, 200);
    world.spendPlayerBullets();
    world.sweep();
    expect(world.playerBullets.count).toBe(0);
  });
});

describe('World — pickups already spent', () => {
  it('leaves a spent pickup where it is until the sweep releases it', () => {
    const world = new World();
    world.spawnPickup(PickupKind.PRed, 100, 50);
    const pickup = world.pickups.at(0);
    pickup.spent = true;
    world.movePickups();
    expect(pickup.position).toEqual({ x: 100, y: 50 });
    expect(pickup.age).toBe(0);
  });
});

describe('World — shot counters (GDD v0.23 §9.5)', () => {
  it('counts the bullets that exist, not those a full pool refused', () => {
    const world = new World();
    for (let i = 0; i < PLAYER_BULLET_POOL_SIZE + 2; i += 1)
      world.spawnPlayerBullet(100, 100, SHOT);
    for (let i = 0; i < ENEMY_BULLET_POOL_SIZE + 3; i += 1) world.spawnEnemyBullet(100, 100, 0, 75);
    expect([world.playerShots, world.enemyShots]).toEqual([
      PLAYER_BULLET_POOL_SIZE,
      ENEMY_BULLET_POOL_SIZE,
    ]);
  });
});
