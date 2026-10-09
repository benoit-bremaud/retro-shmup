import { describe, expect, it } from 'vitest';
import { PLAYER_BULLET_POOL_SIZE } from '../../src/domain/game/tuning';
import { World } from '../../src/domain/game/world';

const DT = 1 / 60;

const SHOT = { vxPerSecond: 0, vyPerSecond: -360, width: 2, height: 8, damage: 1, pierce: 0 };

function spawnAt(world: World, x: number, y: number): void {
  world.spawnPlayerBullet(x, y, SHOT);
}

function ys(world: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < world.playerBulletCount; i += 1) {
    const bullet = world.playerBullets[i];
    if (bullet !== undefined) out.push(bullet.position.y);
  }
  return out;
}

describe('World — player bullets (class diagram notes, GDD v0.5 §4.3)', () => {
  it('spawns a bullet with both positions equal, so it never smears', () => {
    const world = new World();
    spawnAt(world, 100, 200);
    const bullet = world.playerBullets[0];
    expect(world.playerBulletCount).toBe(1);
    expect(bullet?.position).toEqual({ x: 100, y: 200 });
    expect(bullet?.previousPosition).toEqual({ x: 100, y: 200 });
  });

  it('moves bullets by their velocity in px/s times dt and keeps the previous position', () => {
    const world = new World();
    spawnAt(world, 100, 200);
    world.moveBullets(DT);
    expect(world.playerBullets[0]?.position.y).toBeCloseTo(194, 9);
    expect(world.playerBullets[0]?.previousPosition.y).toBe(200);
  });

  it('releases a bullet once it is fully above the field, and only then', () => {
    const world = new World();
    spawnAt(world, 100, -3.5); // centre above the field, bottom 0.5 px still visible
    world.releaseOffscreen();
    expect(world.playerBulletCount).toBe(1);
    spawnAt(world, 100, -4); // bottom edge exactly on the top of the field
    world.releaseOffscreen();
    expect(ys(world)).toEqual([-3.5]);
  });

  it('drops a shot when the pool is empty, without allocating', () => {
    const world = new World();
    for (let i = 0; i < PLAYER_BULLET_POOL_SIZE + 3; i += 1) spawnAt(world, 100, 200);
    expect(world.playerBulletCount).toBe(PLAYER_BULLET_POOL_SIZE);
  });

  it('removes several bullets in one pass and keeps every other one', () => {
    const world = new World();
    spawnAt(world, 100, -10);
    spawnAt(world, 100, 50);
    spawnAt(world, 100, -20);
    spawnAt(world, 100, 60);
    world.releaseOffscreen();
    expect(ys(world).sort((a, b) => a - b)).toEqual([50, 60]);
  });

  it('reuses a released bullet for the next shot', () => {
    const world = new World();
    for (let i = 0; i < PLAYER_BULLET_POOL_SIZE; i += 1) spawnAt(world, 100, -10);
    world.releaseOffscreen();
    spawnAt(world, 100, 200);
    expect(ys(world)).toEqual([200]);
  });
});
