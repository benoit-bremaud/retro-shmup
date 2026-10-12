import { describe, expect, it } from 'vitest';
import { Enemy, POPCORN } from '../../src/domain/game/enemy';
import { swayMovement } from '../../src/domain/game/movements';
import type { WorldView } from '../../src/domain/game/movements';

const WORLD: WorldView = { playerPosition: () => ({ x: 0, y: 0 }) };

function body(mirror = false): Enemy {
  const enemy = new Enemy();
  enemy.spawn(POPCORN, { spawn: { x: 120, y: 56 }, mirror }, 1, undefined);
  return enemy;
}

function at(age: number, mirror = false, config = { amplitude: 56, periodS: 8 }): number {
  const enemy = body(mirror);
  enemy.age = age;
  swayMovement(config).tick(enemy, WORLD, 1 / 60);
  return enemy.position.x;
}

describe('swayMovement — x = 120 ± amplitude · sin(2π · age / period) (GDD v0.10 §6.1)', () => {
  it('starts on the axis and reaches the amplitude at a quarter period', () => {
    expect(at(0)).toBe(120);
    expect(at(120)).toBeCloseTo(176, 9);
    expect(at(360)).toBeCloseTo(64, 9);
    expect(at(480)).toBeCloseTo(120, 9);
  });

  it('goes the other way when mirrored', () => {
    expect(at(120, true)).toBeCloseTo(64, 9);
    expect(at(360, true)).toBeCloseTo(176, 9);
  });

  it('is a closed form of the age: the same age gives the same x, whatever came before', () => {
    const config = { amplitude: 72, periodS: 6 };
    expect(at(90, false, config)).toBeCloseTo(192, 9);
    expect(at(90, false, config)).toBe(at(90, false, config));
  });

  it('sets x only: the body keeps its y, and the movement is a frozen object', () => {
    const enemy = body();
    enemy.age = 10;
    swayMovement({ amplitude: 56, periodS: 8 }).tick(enemy, WORLD, 1 / 60);
    expect(enemy.position.y).toBe(56);
    expect(Object.isFrozen(swayMovement({ amplitude: 1, periodS: 1 }))).toBe(true);
  });
});
