import { describe, expect, it } from 'vitest';
import { fanAttack, ringAttack } from '../../src/domain/game/attacks';
import type { EnemyShotSpawner } from '../../src/domain/game/attacks';
import { Enemy, GUNNER, HEAVY_FAN, HEAVY_RING, SizeTier } from '../../src/domain/game/enemy';
import type { EnemyArchetype, SpawnSpec } from '../../src/domain/game/enemy';
import type { Vec2 } from '../../src/domain/game/geometry';
import { enterHoldLeave } from '../../src/domain/game/movements';
import type { WorldView } from '../../src/domain/game/movements';
import { PickupKind } from '../../src/domain/game/pickup';
import { shots } from '../support/shots';

const DT = 1 / 60;
const HOVER: SpawnSpec = { spawn: { x: 120, y: -24 }, hover: { x: 120, y: 72 } };

function shipAt(x: number, y: number): WorldView & { ship: Vec2 } {
  const ship = { x, y };
  return { ship, playerPosition: () => ship };
}

class RecordingShots implements EnemyShotSpawner {
  readonly shots: { x: number; y: number; vx: number; vy: number }[] = [];
  spawnEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    this.shots.push({ x, y, vx, vy });
  }
}

function spawned(archetype: EnemyArchetype, spec: SpawnSpec = HOVER): Enemy {
  const enemy = new Enemy();
  enemy.spawn(archetype, spec, 1, undefined);
  return enemy;
}

function run(enemy: Enemy, world: WorldView, steps: number, sink = new RecordingShots()): void {
  for (let i = 0; i < steps; i += 1) {
    enemy.age += 1;
    enemy.archetype.movement.tick(enemy, world, DT);
    enemy.archetype.attack.tick(enemy, world, sink, DT);
  }
}

/** Angle of a velocity in degrees, 0 = straight down, in [0, 360). */
function angleOf(vx: number, vy: number): number {
  const degrees = (Math.atan2(vx, vy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** Plays a Heavy over its whole life and returns its volleys, one array of shots per volley. */
function volleysOf(archetype: EnemyArchetype, world: WorldView): RecordingShots['shots'][] {
  const heavy = spawned(archetype);
  const sink = new RecordingShots();
  const volleys: RecordingShots['shots'][] = [];
  for (let i = 0; i < 1000; i += 1) {
    const before = sink.shots.length;
    run(heavy, world, 1, sink);
    if (sink.shots.length > before) volleys.push(sink.shots.slice(before));
  }
  return volleys;
}

describe('enterHoldLeave — one movement, two configurations (ADR-0022)', () => {
  it.each([
    [1, 3.5, 60],
    [2, 10, 40],
  ])('travels %s s, holds %s s armed, then leaves the way it came at %s px/s', (t, h, v) => {
    const movement = enterHoldLeave({ travelS: t, holdS: h, leaveSpeed: v });
    const body = spawned(HEAVY_RING);
    const world = shipAt(0, 0);
    const step = (n: number): void => {
      for (let i = 0; i < n; i += 1) {
        body.age += 1;
        movement.tick(body, world, DT);
      }
    };
    step(Math.round(t * 30));
    expect(body.position.y).toBeCloseTo(-24 + 96 / 2, 9);
    expect(body.armed).toBe(false);
    step(Math.round(t * 30));
    expect(body.position).toEqual({ x: 120, y: 72 });
    step(Math.round(h * 60));
    expect(body.position).toEqual({ x: 120, y: 72 });
    expect(body.armed).toBe(true);
    step(1);
    expect(body.armed).toBe(false);
    expect(body.velocity.x).toBeCloseTo(0, 9);
    expect(body.velocity.y).toBeCloseTo(-v, 9);
  });

  it('is a frozen object built once', () => {
    expect(Object.isFrozen(enterHoldLeave({ travelS: 1, holdS: 1, leaveSpeed: 1 }))).toBe(true);
  });
});

describe('Heavy archetypes (GDD v0.10 §5.2, §5.2.1)', () => {
  it.each([HEAVY_RING, HEAVY_FAN])('$id: 56 × 48, Large, 40 shots, 1 000 points', (heavy) => {
    expect(heavy.stats).toEqual({
      hp: shots(40),
      width: 56,
      height: 48,
      score: 1000,
      tier: SizeTier.Large,
    });
    expect(heavy.formation).toBe(false);
    expect(heavy.carriesCargo).toBe(false);
  });

  it.each([HEAVY_RING, HEAVY_FAN])('$id drops a Bomb or a Shield at 60 %', (heavy) => {
    expect(heavy.drops.rate).toBe(0.6);
    expect(heavy.drops.kinds).toEqual([PickupKind.Bomb, PickupKind.Shield]);
  });

  it('enters in 2 s, holds 10 s, and leaves upward at 40 px/s', () => {
    const heavy = spawned(HEAVY_FAN);
    const world = shipAt(120, 272);
    run(heavy, world, 120);
    expect(heavy.position).toEqual({ x: 120, y: 72 });
    run(heavy, world, 600);
    expect(heavy.position).toEqual({ x: 120, y: 72 });
    run(heavy, world, 60);
    expect(heavy.position.y).toBeCloseTo(72 - 40, 9);
  });

  it.each([HEAVY_RING, HEAVY_FAN])(
    '$id fires every 2 s while hovering, the first volley 2 s after it stops',
    (heavy) => {
      const enemy = spawned(heavy);
      const sink = new RecordingShots();
      const firedAt: number[] = [];
      for (let i = 0; i < 1000; i += 1) {
        const before = sink.shots.length;
        run(enemy, shipAt(120, 272), 1, sink);
        if (sink.shots.length > before) firedAt.push(enemy.age);
      }
      expect(firedAt).toEqual([240, 360, 480, 600, 720]);
    },
  );

  it('resets its volley counters on spawn', () => {
    const heavy = spawned(HEAVY_RING);
    heavy.volleys[0] = 7;
    heavy.volleys[1] = 3;
    heavy.spawn(HEAVY_RING, HOVER, 2, undefined);
    expect(heavy.volleys).toEqual([0, 0]);
  });
});

describe('ringAttack — 12 bullets 30° apart at 60 px/s (GDD v0.10 §5.2.1)', () => {
  it('fires 12 bullets from the body, 30° apart, the first straight down', () => {
    const [first] = volleysOf(HEAVY_RING, shipAt(10, 300));
    expect(first).toHaveLength(12);
    const angles = (first ?? []).map((s) => angleOf(s.vx, s.vy));
    for (let i = 0; i < 12; i += 1) {
      expect(angles[i]).toBeCloseTo(30 * i, 9);
    }
    expect(first?.[0]).toMatchObject({ x: 120, y: 72 });
    expect(first?.[0]?.vx).toBeCloseTo(0, 9);
    expect(first?.[0]?.vy).toBeCloseTo(60, 9);
    for (const shot of first ?? []) expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(60, 9);
  });

  it('turns the whole ring by 15° on every other volley, the same on every replay', () => {
    const volleys = volleysOf(HEAVY_RING, shipAt(10, 300));
    expect(volleys).toHaveLength(5);
    // The ring's orientation: its first bullet's angle modulo the 30° spacing.
    const firstAngles = volleys.map((v) => angleOf(v[0]?.vx ?? 0, v[0]?.vy ?? 0) % 30);
    expect(firstAngles[0]).toBeCloseTo(0, 9);
    expect(firstAngles[1]).toBeCloseTo(15, 9);
    expect(firstAngles[2]).toBeCloseTo(0, 9);
    expect(firstAngles[3]).toBeCloseTo(15, 9);
    expect(firstAngles[4]).toBeCloseTo(0, 9);
    expect(volleysOf(HEAVY_RING, shipAt(200, 10))).toEqual(volleys);
  });

  it('never fires while disarmed', () => {
    const ring = ringAttack({ count: 12, periodS: 2, speed: 60, rotateDeg: 15 });
    const body = spawned(HEAVY_RING);
    const sink = new RecordingShots();
    for (let i = 0; i < 600; i += 1) ring.tick(body, shipAt(0, 0), sink, DT);
    expect(sink.shots).toEqual([]);
  });
});

describe('fanAttack — 5 bullets 15° apart, centred on the aim, at 75 px/s', () => {
  it('centres the fan on the ship', () => {
    const [first] = volleysOf(HEAVY_FAN, shipAt(120 + 100, 72 + 100));
    expect(first).toHaveLength(5);
    const angles = (first ?? []).map((s) => angleOf(s.vx, s.vy)).sort((a, b) => a - b);
    expect(angles.map((a) => Math.round(a * 1e6) / 1e6)).toEqual([15, 30, 45, 60, 75]);
    for (const shot of first ?? []) {
      expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(75, 9);
      expect(shot).toMatchObject({ x: 120, y: 72 });
    }
  });

  it('fires the fan straight down when the ship is exactly on it', () => {
    const [first] = volleysOf(HEAVY_FAN, shipAt(120, 72));
    const angles = (first ?? []).map((s) => {
      const a = angleOf(s.vx, s.vy);
      return Math.round((a > 180 ? a - 360 : a) * 1e6) / 1e6;
    });
    expect(angles.sort((a, b) => a - b)).toEqual([-30, -15, 0, 15, 30]);
  });

  it('never fires while disarmed', () => {
    const fan = fanAttack({ count: 5, spreadDeg: 15, periodS: 2, speed: 75 });
    const body = spawned(HEAVY_FAN);
    const sink = new RecordingShots();
    for (let i = 0; i < 600; i += 1) fan.tick(body, shipAt(0, 0), sink, DT);
    expect(sink.shots).toEqual([]);
  });
});

describe('volley counting (ADR-0022)', () => {
  it('counts the volleys of an aimed attack, so a sequence can pick its pattern from them', () => {
    const gunner = spawned(GUNNER);
    const sink = new RecordingShots();
    run(gunner, shipAt(10, 300), 900, sink);
    expect(sink.shots.length).toBeGreaterThan(0);
    expect(gunner.volleys[0]).toBe(sink.shots.length);
  });
});
