import { describe, expect, it } from 'vitest';
import { SpreadLevel1 } from '../../src/domain/game/tuning';
import { Weapon } from '../../src/domain/game/weapon';
import type { BulletSpawner } from '../../src/domain/game/weapon';

interface SpawnedShot {
  step: number;
  x: number;
  y: number;
  vxPerSecond: number;
  vyPerSecond: number;
  width: number;
  height: number;
  damage: number;
  pierce: number;
}

/** Records the shots it is asked to spawn, with the step they were fired on. */
class RecordingSpawner implements BulletSpawner {
  step = 0;
  readonly shots: SpawnedShot[] = [];
  spawnPlayerBullet(
    x: number,
    y: number,
    vxPerSecond: number,
    vyPerSecond: number,
    width: number,
    height: number,
    damage: number,
    pierce: number,
  ): void {
    this.shots.push({
      step: this.step,
      x,
      y,
      vxPerSecond,
      vyPerSecond,
      width,
      height,
      damage,
      pierce,
    });
  }
}

const ORIGIN = { x: 100, y: 200 };

function fire(weapon: Weapon, spawner: RecordingSpawner, pattern: readonly boolean[]): void {
  for (let i = 0; i < pattern.length; i += 1) {
    spawner.step = i;
    weapon.tick(ORIGIN, pattern[i] ?? false, spawner);
  }
}

describe('Weapon — Spread level 1 (GDD v0.5 §4.3)', () => {
  it('fires at once, then one shot every 6 steps while fire is held (10 per second)', () => {
    const spawner = new RecordingSpawner();
    fire(
      new Weapon(),
      spawner,
      Array.from({ length: 60 }, () => true),
    );
    expect(spawner.shots.map((shot) => shot.step)).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54]);
  });

  it('never fires faster when fire is tapped every other step', () => {
    const spawner = new RecordingSpawner();
    fire(
      new Weapon(),
      spawner,
      Array.from({ length: 60 }, (_, i) => i % 2 === 0),
    );
    expect(spawner.shots).toHaveLength(10);
  });

  it('fires nothing while fire is released', () => {
    const spawner = new RecordingSpawner();
    fire(
      new Weapon(),
      spawner,
      Array.from({ length: 30 }, () => false),
    );
    expect(spawner.shots).toEqual([]);
  });

  it('fires one 2 × 8 bullet straight up from the nose at 360 px/s', () => {
    const spawner = new RecordingSpawner();
    fire(new Weapon(), spawner, [true]);
    expect(spawner.shots).toEqual([
      {
        step: 0,
        x: ORIGIN.x,
        y: ORIGIN.y - SpreadLevel1.noseOffset,
        vxPerSecond: 0,
        vyPerSecond: -SpreadLevel1.speed,
        width: SpreadLevel1.width,
        height: SpreadLevel1.height,
        damage: SpreadLevel1.damage,
        pierce: 0,
      },
    ]);
  });
});
