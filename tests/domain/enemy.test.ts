import { describe, expect, it } from 'vitest';
import type { EnemyShotSpawner } from '../../src/domain/game/attacks';
import { applyDamage } from '../../src/domain/game/body';
import { DIVER, Enemy, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import type { EnemyArchetype, SpawnSpec } from '../../src/domain/game/enemy';
import type { Vec2 } from '../../src/domain/game/geometry';
import type { WorldView } from '../../src/domain/game/movements';
import { shots } from '../support/shots';

const DT = 1 / 60;

/** A world whose ship stands where the test puts it. */
function shipAt(x: number, y: number): WorldView & { ship: Vec2 } {
  const ship = { x, y };
  return { ship, playerPosition: () => ship };
}

/** Records the enemy bullets an attack asks for. */
class RecordingShots implements EnemyShotSpawner {
  readonly shots: { x: number; y: number; vx: number; vy: number }[] = [];
  spawnEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    this.shots.push({ x, y, vx, vy });
  }
}

function spawned(archetype: EnemyArchetype, spec: SpawnSpec): Enemy {
  const enemy = new Enemy();
  enemy.spawn(archetype, spec, 1, undefined);
  return enemy;
}

/** Steps an enemy as `World.moveEnemies` does: age first, then movement and attack. */
function run(enemy: Enemy, world: WorldView, steps: number, shots = new RecordingShots()): void {
  for (let i = 0; i < steps; i += 1) {
    enemy.age += 1;
    enemy.archetype.movement.tick(enemy, world, DT);
    enemy.archetype.attack.tick(enemy, world, shots, DT);
  }
}

describe('applyDamage — destroyed at most once (class diagram notes)', () => {
  it('is true only on the step the HP crosses to 0', () => {
    const gunner = spawned(GUNNER, { spawn: { x: 0, y: 0 } });
    expect(applyDamage(gunner, shots(9))).toBe(false);
    expect(applyDamage(gunner, shots(1))).toBe(true);
    expect(applyDamage(gunner, shots(1))).toBe(false);
  });
});

describe('Enemy.spawn — resets every field (class diagram notes)', () => {
  it('leaves a recycled enemy exactly like a fresh one', () => {
    const spec: SpawnSpec = { spawn: { x: 10, y: -8 }, hover: { x: 60, y: 80 } };
    const fresh = spawned(GUNNER, spec);
    const recycled = spawned(DIVER, { spawn: { x: 200, y: 50 }, mirror: true });
    for (const [key, value] of Object.entries(recycled)) {
      if (typeof value === 'number') Object.assign(recycled, { [key]: 99 });
      if (typeof value === 'boolean') Object.assign(recycled, { [key]: !value });
      if (typeof value === 'object' && 'x' in value) Object.assign(value, { x: 5, y: 5 });
    }
    recycled.spawn(GUNNER, spec, 1, undefined);
    expect(recycled).toEqual(fresh);
  });

  it('starts with both positions equal, so it never smears', () => {
    const enemy = spawned(POPCORN, { spawn: { x: 80, y: -8 } });
    expect(enemy.previousPosition).toEqual(enemy.position);
  });

  it('takes the stats of its archetype, HP in tenths of a level-1 shot (GDD §5.2, ADR-0019)', () => {
    expect([POPCORN, DIVER, GUNNER].map((a) => [a.stats.width, a.stats.hp, a.stats.score])).toEqual(
      [
        [16, shots(1), 100],
        [16, shots(1), 150],
        [32, shots(10), 300],
      ],
    );
  });
});

describe('PathMovement — Popcorn S curve (GDD v0.6 §5.2.1)', () => {
  it('moves down at 70 px/s with x = x0 + 40 · sin(2π · y / 160)', () => {
    const popcorn = spawned(POPCORN, { spawn: { x: 80, y: -8 } });
    run(popcorn, shipAt(0, 0), 60);
    const y = -8 + 70;
    expect(popcorn.position.y).toBeCloseTo(y, 9);
    expect(popcorn.position.x).toBeCloseTo(80 + 40 * Math.sin((2 * Math.PI * y) / 160), 9);
  });

  it('mirrored, negates the offset: the same axis, the other side', () => {
    const plain = spawned(POPCORN, { spawn: { x: 160, y: -8 } });
    const mirrored = spawned(POPCORN, { spawn: { x: 160, y: -8 }, mirror: true });
    run(plain, shipAt(0, 0), 37);
    run(mirrored, shipAt(0, 0), 37);
    expect(mirrored.position.x - 160).toBeCloseTo(-(plain.position.x - 160), 9);
  });

  it('keeps the x0 160 wave within 120–200 (the opposite side of the x0 80 wave)', () => {
    const popcorn = spawned(POPCORN, { spawn: { x: 160, y: -8 }, mirror: true });
    for (let i = 0; i < 300; i += 1) {
      run(popcorn, shipAt(0, 0), 1);
      expect(popcorn.position.x).toBeGreaterThanOrEqual(120);
      expect(popcorn.position.x).toBeLessThanOrEqual(200);
    }
  });
});

describe('DiveMovement — Diver (GDD v0.6 §5.2.1)', () => {
  it('enters at 60 px/s for 1 s, then dives at 180 px/s toward the ship at that moment', () => {
    const world = shipAt(80, 260);
    const diver = spawned(DIVER, { spawn: { x: 80, y: -8 } });
    run(diver, world, 60);
    expect(diver.position).toEqual({ x: 80, y: 52 });
    expect(diver.diveTarget).toEqual({ x: 80, y: 260 });
    run(diver, world, 1);
    expect(diver.position.y).toBeCloseTo(52 + 3, 9);
  });

  it('keeps its heading after the ship moves', () => {
    const world = shipAt(200, 260);
    const diver = spawned(DIVER, { spawn: { x: 80, y: -8 } });
    run(diver, world, 60);
    const heading = { ...diver.velocity };
    world.ship.x = 10;
    run(diver, world, 20);
    expect(diver.velocity).toEqual(heading);
  });

  it('dives straight down when the ship is exactly on it', () => {
    const diver = spawned(DIVER, { spawn: { x: 80, y: -8 } });
    run(diver, shipAt(80, 52), 60);
    expect(diver.velocity).toEqual({ x: 0, y: 180 });
  });
});

describe('EnterHoldLeave and AimedAttack — Gunner (GDD v0.6 §5.2.1)', () => {
  it('flies from its spawn point to its hover point in 1 s, holds 3.5 s, then leaves the way it came', () => {
    const gunner = spawned(GUNNER, { spawn: { x: -16, y: 80 }, hover: { x: 60, y: 80 } });
    const world = shipAt(120, 272);
    run(gunner, world, 30);
    expect(gunner.position.x).toBeCloseTo(22, 9);
    run(gunner, world, 30);
    expect(gunner.position).toEqual({ x: 60, y: 80 });
    run(gunner, world, 210);
    expect(gunner.position).toEqual({ x: 60, y: 80 });
    run(gunner, world, 1);
    expect(gunner.position.x).toBeCloseTo(59, 9);
    expect(gunner.velocity.y).toBeCloseTo(0, 9);
  });

  // GDD v0.18 §5.2.1: it stops at 1 s (frame 60) and holds 3.5 s (to frame 270); one bullet
  // every 0.8 s from the stop gives frames 108, 156, 204 and 252 — the next (300) falls after the hold.
  it('fires 4 aimed bullets per hold: 0.8, 1.6, 2.4 and 3.2 s after it stops', () => {
    const gunner = spawned(GUNNER, { spawn: { x: 120, y: -16 }, hover: { x: 120, y: 80 } });
    const shots = new RecordingShots();
    const firedAt: number[] = [];
    for (let i = 0; i < 400; i += 1) {
      const before = shots.shots.length;
      run(gunner, shipAt(120, 272), 1, shots);
      if (shots.shots.length > before) firedAt.push(gunner.age);
    }
    expect(firedAt).toEqual([108, 156, 204, 252]);
  });

  it('aims at the ship at 85 px/s, slower than the ship (150 px/s)', () => {
    const gunner = spawned(GUNNER, { spawn: { x: 120, y: -16 }, hover: { x: 120, y: 80 } });
    const shots = new RecordingShots();
    run(gunner, shipAt(180, 160), 150, shots);
    const shot = shots.shots[0];
    expect(Math.hypot(shot?.vx ?? 0, shot?.vy ?? 0)).toBeCloseTo(85, 9);
    expect((shot?.vx ?? 0) / (shot?.vy ?? 1)).toBeCloseTo(60 / 80, 9);
  });

  it('fires straight down when the ship is exactly on it', () => {
    const gunner = spawned(GUNNER, { spawn: { x: 120, y: -16 }, hover: { x: 120, y: 80 } });
    const shots = new RecordingShots();
    run(gunner, shipAt(120, 80), 150, shots);
    expect(shots.shots[0]).toMatchObject({ vx: 0, vy: 85 });
  });

  it('never fires while disarmed (entering or leaving)', () => {
    const gunner = spawned(GUNNER, { spawn: { x: 120, y: -16 }, hover: { x: 120, y: 80 } });
    gunner.armed = false;
    const shots = new RecordingShots();
    GUNNER.attack.tick(gunner, shipAt(0, 0), shots, DT);
    expect(shots.shots).toEqual([]);
  });
});
