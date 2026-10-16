import { describe, expect, it } from 'vitest';
import { Weapon, WEAPONS, WeaponKind } from '../../src/domain/game/weapon';
import type { PlayerShotSpawner, ShotSpec } from '../../src/domain/game/weapon';
import { shots } from '../support/shots';

interface SpawnedShot extends ShotSpec {
  step: number;
  x: number;
  y: number;
}

/** Records the shots it is asked to spawn, with the step they were fired on. */
class RecordingSpawner implements PlayerShotSpawner {
  step = 0;
  readonly shots: SpawnedShot[] = [];
  spawnPlayerBullet(x: number, y: number, shot: Readonly<ShotSpec>): void {
    this.shots.push({ step: this.step, x, y, ...shot });
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
        x: 100,
        y: 184,
        vxPerSecond: 0,
        vyPerSecond: -360,
        width: 2,
        height: 8,
        offsetX: 0,
        offsetY: -16,
        damage: shots(1),
        pierce: 0,
        weapon: WeaponKind.Spread,
      },
    ]);
  });
});

/** The volley of `kind` at `level`, as (x offset, y offset, vx, vy, w, h, damage, pierce). */
function volley(kind: WeaponKind, level: number): number[][] {
  const record = WEAPONS[kind][level - 1];
  if (record === undefined) throw new RangeError('no such level');
  return record.shots.map((s) => [
    s.offsetX,
    s.offsetY,
    Math.round(s.vxPerSecond * 1000) / 1000,
    Math.round(s.vyPerSecond * 1000) / 1000,
    s.width,
    s.height,
    s.damage,
    s.pierce,
  ]);
}

/** A stream along `degrees` from straight up at 360 px/s, rounded like `volley`. */
function stream(degrees: number, damage: number): number[] {
  const radians = (degrees * Math.PI) / 180;
  return [
    0,
    -16,
    Math.round(360 * Math.sin(radians) * 1000) / 1000,
    Math.round(-360 * Math.cos(radians) * 1000) / 1000,
    2,
    8,
    damage,
    0,
  ];
}

describe('WEAPONS — the Spread table (GDD v0.8 §4.3)', () => {
  it.each([
    [1, [[0, 1]]],
    [
      2,
      [
        [0, 1.4],
        [-6, 1],
        [6, 1],
      ],
    ],
    [
      3,
      [
        [0, 1.9],
        [-12, 1],
        [12, 1],
      ],
    ],
    [
      4,
      [
        [0, 2.4],
        [-6, 1],
        [6, 1],
        [-14, 1],
        [14, 1],
      ],
    ],
    [
      5,
      [
        [0, 2],
        [-8, 1],
        [8, 1],
        [-18, 1],
        [18, 1],
      ],
    ],
  ])('fires the level-%i streams at their angles, centre then sides', (level, streams) => {
    expect(volley(WeaponKind.Spread, level)).toEqual(
      streams.map(([angle, damage]) => stream(angle ?? 0, shots(damage ?? 0))),
    );
  });

  it('carries the power ratio on the centre stream: ×1.0, 1.4, 1.9, 2.4, 3.0 per second', () => {
    const level1PerSecond = shots(1) * 10;
    const ratios = WEAPONS[WeaponKind.Spread].map((level) => {
      const centre = level.shots[0]?.damage ?? 0;
      return Math.round(((centre * 60) / level.cooldownSteps / level1PerSecond) * 10) / 10;
    });
    expect(ratios).toEqual([1, 1.4, 1.9, 2.4, 3]);
  });

  it('never deals less than one level-1 shot with any bullet', () => {
    for (const kind of [WeaponKind.Spread, WeaponKind.Laser]) {
      for (const level of WEAPONS[kind]) {
        for (const shot of level.shots) expect(shot.damage).toBeGreaterThanOrEqual(shots(1));
      }
    }
  });
});

describe('WEAPONS — the Laser table (GDD v0.24 §4.3)', () => {
  it.each([
    [1, 2, 1],
    [2, 3, 1.5],
    [3, 4, 2],
    [4, 6, 2.5],
    [5, 8, 3],
  ])(
    'fires at level %i one 48 px bolt %i px wide, %d level-1 shots, passing through none',
    (level, width, damage) => {
      expect(volley(WeaponKind.Laser, level)).toEqual([
        [0, -40, 0, -600, width, 48, shots(damage), 0],
      ]);
      expect(WEAPONS[WeaponKind.Laser][level - 1]?.cooldownSteps).toBe(6);
    },
  );
});

describe('Weapon — firing the current table (GDD v0.8 §4.3)', () => {
  /** A weapon raised to `level` of `kind`. */
  function weaponAt(kind: WeaponKind, level: number): Weapon {
    const weapon = new Weapon();
    weapon.powerUp(kind);
    for (let i = 2; i < level; i += 1) weapon.powerUp(kind);
    expect([weapon.kind, weapon.level]).toEqual([kind, Math.max(level, 2)]);
    return weapon;
  }

  it('fires the five Spread streams of level 5 every 4 steps (15 per second)', () => {
    const spawner = new RecordingSpawner();
    fire(
      weaponAt(WeaponKind.Spread, 5),
      spawner,
      Array.from({ length: 60 }, () => true),
    );
    expect(spawner.shots).toHaveLength(15 * 5);
    expect(spawner.shots.filter((s) => s.step === 4)).toHaveLength(5);
  });

  it('places a Laser bolt with its lower end at the nose', () => {
    const spawner = new RecordingSpawner();
    fire(weaponAt(WeaponKind.Laser, 2), spawner, [true]);
    const bolt = spawner.shots[0];
    expect(bolt).toMatchObject({ x: 100, y: 160, width: 3, height: 48, weapon: WeaponKind.Laser });
    expect((bolt?.y ?? 0) + (bolt?.height ?? 0) / 2).toBe(ORIGIN.y - 16);
  });
});
