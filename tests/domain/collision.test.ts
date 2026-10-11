import { describe, expect, it } from 'vitest';
import { CollisionResolver } from '../../src/domain/game/collision';
import type { HitRules } from '../../src/domain/game/collision';
import { DIVER, GUNNER } from '../../src/domain/game/enemy';
import type { Enemy, EnemyArchetype } from '../../src/domain/game/enemy';
import type { Pickup } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import { World } from '../../src/domain/game/world';
import { createIntentFrame } from '../../src/domain/ports/input-port';

const DT = 1 / 60;
const SHOT = { vxPerSecond: 0, vyPerSecond: -360, width: 2, height: 8, damage: 1, pierce: 0 };

/** The run's side of the collisions, recorded; marks a destroyed enemy like `Run` does. */
class Rules implements HitRules {
  hits = 0;
  destroyed: number[] = [];
  deaths = 0;
  enemyHit(): void {
    this.hits += 1;
  }
  destroyEnemy(enemy: Enemy): void {
    enemy.spent = true;
    this.destroyed.push(enemy.serial);
  }
  playerDied(): void {
    this.deaths += 1;
  }
  readonly collected: number[] = [];
  pickupCollected(pickup: Pickup): void {
    this.collected.push(pickup.kind);
  }
}

/** A world whose ship is vulnerable at its resting point (120, 272). */
function vulnerableWorld(): World {
  const world = new World();
  const idle = createIntentFrame();
  for (let i = 0; i < 120; i += 1) {
    world.player.update(idle, DT, world);
    world.player.advanceTimers();
  }
  return world;
}

function enemyAt(world: World, archetype: EnemyArchetype, x: number, y: number): Enemy {
  world.spawnEnemy({ at: 0, archetype, count: 1, spawn: { x, y } }, undefined);
  const enemy = world.enemies.at(world.enemies.count - 1);
  enemy.position.x = x;
  enemy.position.y = y;
  return enemy;
}

describe('CollisionResolver — shots against enemies (GDD §5.2, class diagram)', () => {
  it('lowers the HP by the shot damage, consumes the bullet and reports the hit', () => {
    const world = new World();
    const gunner = enemyAt(world, GUNNER, 100, 100);
    world.spawnPlayerBullet(100, 100, SHOT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(gunner.hp).toBe(7);
    expect(world.playerBullets.at(0).spent).toBe(true);
    expect(rules.hits).toBe(1);
  });

  it('destroys an enemy once when two bullets bring it to 0 HP in one step', () => {
    const world = new World();
    enemyAt(world, DIVER, 100, 100);
    world.spawnPlayerBullet(100, 100, SHOT);
    world.spawnPlayerBullet(100, 102, SHOT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.destroyed).toHaveLength(1);
    expect(() => {
      world.sweep();
    }).not.toThrow();
    expect(world.enemies.count).toBe(0);
  });

  it('lets a consumed bullet hit only one of two overlapping enemies', () => {
    const world = new World();
    enemyAt(world, GUNNER, 100, 100);
    enemyAt(world, GUNNER, 102, 100);
    world.spawnPlayerBullet(101, 100, SHOT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.hits).toBe(1);
  });
});

describe('CollisionResolver — hazards against the 4 × 4 hitbox (GDD §4.1, §4.4)', () => {
  it('kills a vulnerable ship hit by an enemy bullet, and consumes the bullet', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(120, 272, 0, 75);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(world.player.state).toBe(PlayerState.Dead);
    expect(world.enemyBullets.at(0).spent).toBe(true);
    expect(rules.deaths).toBe(1);
  });

  it('ignores a bullet that only touches the sprite, outside the hitbox', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(120 + 5, 272, 0, 75); // 4 px wide: reaches x 123, the hitbox ends at 122
    CollisionResolver.resolve(world, new Rules());
    expect(world.player.state).toBe(PlayerState.Vulnerable);
  });

  it('ignores an enemy body that touches the sprite but not the hitbox', () => {
    const world = vulnerableWorld();
    enemyAt(world, DIVER, 120 + 11, 272); // 16 px wide: reaches x 123, the hitbox ends at 122
    CollisionResolver.resolve(world, new Rules());
    expect(world.player.state).toBe(PlayerState.Vulnerable);
  });

  it('consumes only the killing bullet: a second one in the same step passes through', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(120, 272, 0, 75);
    world.spawnEnemyBullet(121, 272, 0, 75);
    CollisionResolver.resolve(world, new Rules());
    expect([world.enemyBullets.at(0).spent, world.enemyBullets.at(1).spent]).toEqual([true, false]);
  });

  it('lets bullets pass through an invulnerable ship, without consuming them', () => {
    const world = new World();
    const idle = createIntentFrame();
    for (let i = 0; i < 40; i += 1) {
      world.player.update(idle, DT, world);
      world.player.advanceTimers();
    }
    world.spawnEnemyBullet(120, 272, 0, 75);
    CollisionResolver.resolve(world, new Rules());
    expect(world.player.lives).toBe(3);
    expect(world.enemyBullets.at(0).spent).toBe(false);
  });

  it('costs one life when two hazards touch the ship in the same step', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(120, 272, 0, 75);
    enemyAt(world, DIVER, 120, 272);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(world.player.lives).toBe(2);
    expect(rules.deaths).toBe(1);
  });

  it('hurts the ship on contact, never the enemy', () => {
    const world = vulnerableWorld();
    const gunner = enemyAt(world, GUNNER, 120, 272);
    CollisionResolver.resolve(world, new Rules());
    expect(world.player.state).toBe(PlayerState.Dead);
    expect(gunner.hp).toBe(8);
  });
});
