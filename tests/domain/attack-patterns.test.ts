import { describe, expect, it } from 'vitest';
import { aimedAttack, fanAttack, ringAttack, sequenceAttack } from '../../src/domain/game/attacks';
import type { AttackPattern, EnemyShotSpawner } from '../../src/domain/game/attacks';
import { Enemy, POPCORN } from '../../src/domain/game/enemy';
import type { Vec2 } from '../../src/domain/game/geometry';
import type { WorldView } from '../../src/domain/game/movements';

const DT = 1 / 60;

function shipAt(x: number, y: number): WorldView {
  const ship: Vec2 = { x, y };
  return { playerPosition: () => ship };
}

class RecordingShots implements EnemyShotSpawner {
  readonly shots: { x: number; y: number; vx: number; vy: number }[] = [];
  spawnEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    this.shots.push({ x, y, vx, vy });
  }
}

function body(): Enemy {
  const enemy = new Enemy();
  enemy.spawn(POPCORN, { spawn: { x: 120, y: 56 } }, 1, undefined);
  return enemy;
}

/** The angle of a velocity in degrees, 0 = straight down, in [0, 360). */
function angleOf(vx: number, vy: number): number {
  return ((((Math.atan2(vx, vy) * 180) / Math.PI) % 360) + 360) % 360;
}

describe('fire — one volley for a given count, with no timing (ADR-0023)', () => {
  const world = shipAt(120, 272);

  it('fires an aimed bullet at once, whatever the body timer says', () => {
    const sink = new RecordingShots();
    aimedAttack({ periodS: 1, speed: 75 }).fire(body(), world, sink, 0);
    expect(sink.shots).toHaveLength(1);
    expect(sink.shots[0]?.vy).toBeCloseTo(75, 9);
  });

  it('fires a fan centred on the aim', () => {
    const sink = new RecordingShots();
    fanAttack({ count: 5, spreadDeg: 15, periodS: 1, speed: 75 }).fire(body(), world, sink, 0);
    const angles = sink.shots.map((s) => angleOf(s.vx, s.vy));
    expect(angles.map((a) => Math.round(((a + 180) % 360) - 180))).toEqual([-30, -15, 0, 15, 30]);
  });

  it('turns a ring by rotateDeg times the count it is given, not by the body volleys', () => {
    const sink = new RecordingShots();
    const enemy = body();
    enemy.volleys[0] = 99;
    ringAttack({ count: 16, periodS: 1, speed: 60, rotateDeg: 11.25 }).fire(enemy, world, sink, 3);
    expect(sink.shots).toHaveLength(16);
    expect(angleOf(sink.shots[0]?.vx ?? 0, sink.shots[0]?.vy ?? 0)).toBeCloseTo(33.75, 6);
    expect(enemy.volleys[0]).toBe(99);
  });

  it('leaves the timer alone and the tick counts its own volleys', () => {
    const sink = new RecordingShots();
    const enemy = body();
    enemy.armed = true;
    const ring = ringAttack({ count: 4, periodS: 1, speed: 60, rotateDeg: 10 });
    ring.fire(enemy, world, sink, 0);
    expect(enemy.fireTimer).toBe(0);
    for (let i = 0; i < 120; i += 1) ring.tick(enemy, world, sink, DT);
    expect(enemy.volleys[0]).toBe(2);
    expect(sink.shots).toHaveLength(4 + 8);
  });
});

describe('sequenceAttack — groups taking turns on one timer (ADR-0023)', () => {
  const world = shipAt(120, 272);
  const FAN = fanAttack({ count: 5, spreadDeg: 15, periodS: 99, speed: 75 });
  const RING12 = ringAttack({ count: 12, periodS: 99, speed: 60, rotateDeg: 0 });

  function play(attack: AttackPattern, steps: number): RecordingShots[] {
    const enemy = body();
    // As the boss does: a disarmed tick fills the timer, so the first volley is a period away.
    attack.tick(enemy, world, new RecordingShots(), DT);
    enemy.armed = true;
    const volleys: RecordingShots[] = [];
    for (let i = 0; i < steps; i += 1) {
      const sink = new RecordingShots();
      attack.tick(enemy, world, sink, DT);
      if (sink.shots.length > 0) volleys[i] = sink;
    }
    return volleys;
  }

  it('phase 1 of the Cruiser: a fan 1 s in, a ring at 2 s, a fan at 3 s, the inner periods ignored', () => {
    const attack = sequenceAttack([[FAN], [RING12]], 1);
    const volleys = play(attack, 200);
    const steps = volleys.map((_v, i) => i).filter((i) => volleys[i] !== undefined);
    expect(steps).toEqual([59, 119, 179]);
    expect(volleys[59]?.shots).toHaveLength(5);
    expect(volleys[119]?.shots).toHaveLength(12);
    expect(volleys[179]?.shots).toHaveLength(5);
  });

  it('keeps the phase-1 ring unturned: its first bullet points straight down every time', () => {
    const attack = sequenceAttack([[RING12], [RING12]], 1);
    const volleys = play(attack, 200);
    for (const step of [59, 119, 179]) {
      expect(
        angleOf(volleys[step]?.shots[0]?.vx ?? 1, volleys[step]?.shots[0]?.vy ?? 0),
      ).toBeCloseTo(0, 6);
    }
  });

  it('phase 2: a ring turned by 11.25° per volley every 1.5 s, a triple on volleys 1, 3, 5', () => {
    const ring16 = ringAttack({ count: 16, periodS: 99, speed: 60, rotateDeg: 11.25 });
    const triple = fanAttack({ count: 3, spreadDeg: 15, periodS: 99, speed: 75 });
    const attack = sequenceAttack([[ring16], [ring16, triple]], 1.5);
    const volleys = play(attack, 600);
    const steps = volleys.map((_v, i) => i).filter((i) => volleys[i] !== undefined);
    expect(steps).toEqual([89, 179, 269, 359, 449, 539]);
    // Rings on every volley, turned by 11.25° × the volley index.
    steps.forEach((step, index) => {
      const first = (volleys[step]?.shots ?? [])[0];
      expect(angleOf(first?.vx ?? 0, first?.vy ?? 0)).toBeCloseTo((11.25 * index) % 360, 6);
    });
    // The triple rides on volleys 1, 3, 5: 3 s, 6 s, 9 s after the change.
    expect(steps.map((step) => volleys[step]?.shots.length)).toEqual([16, 19, 16, 19, 16, 19]);
  });

  it('never fires while disarmed, and its first volley comes one period into the hold', () => {
    const attack = sequenceAttack([[FAN]], 1);
    const enemy = body();
    const sink = new RecordingShots();
    for (let i = 0; i < 100; i += 1) attack.tick(enemy, world, sink, DT);
    expect(sink.shots).toHaveLength(0);
    enemy.armed = true;
    for (let i = 0; i < 59; i += 1) attack.tick(enemy, world, sink, DT);
    expect(sink.shots).toHaveLength(0);
    attack.tick(enemy, world, sink, DT);
    expect(sink.shots).toHaveLength(5);
  });

  it('is a frozen object and needs at least one group', () => {
    expect(Object.isFrozen(sequenceAttack([[FAN]], 1))).toBe(true);
    expect(() => sequenceAttack([], 1)).toThrow(RangeError);
  });
});
