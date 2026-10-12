import { describe, expect, it } from 'vitest';
import { CollisionResolver } from '../../src/domain/game/collision';
import type { HitRules } from '../../src/domain/game/collision';
import { BossState } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import { DIVER, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import type { Enemy, EnemyArchetype } from '../../src/domain/game/enemy';
import { PickupKind } from '../../src/domain/game/pickup';
import type { Pickup } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import { WEAPONS, WeaponKind } from '../../src/domain/game/weapon';
import type { ShotSpec } from '../../src/domain/game/weapon';
import { PLAYER_BULLET_POOL_SIZE } from '../../src/domain/game/tuning';
import { World } from '../../src/domain/game/world';
import { createIntentFrame } from '../../src/domain/ports/input-port';
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
  absorbed = 0;
  shieldBroken(): void {
    this.absorbed += 1;
  }
  readonly bossDamage: number[] = [];
  damageBoss(amount: number): void {
    this.bossDamage.push(amount);
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
    expect(gunner.hp).toBe(shots(7));
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
    expect(gunner.hp).toBe(shots(8));
  });
});

describe('CollisionResolver — Laser pass-throughs (GDD v0.8 §4.3)', () => {
  const BOLT: ShotSpec = {
    ...SHOT,
    width: 8,
    height: 48,
    damage: shots(3),
    pierce: 2,
    weapon: WeaponKind.Laser,
  };

  it('passes through the two nearest enemies, full damage to each, and is spent on the third', () => {
    const world = new World();
    const a = enemyAt(world, GUNNER, 100, 60);
    const b = enemyAt(world, GUNNER, 100, 80);
    const c = enemyAt(world, GUNNER, 100, 100);
    const d = enemyAt(world, GUNNER, 100, 110);
    world.spawnPlayerBullet(100, 85, BOLT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    // Travel order: d, c and b, the nearest to the ship; a, the farthest, is never reached.
    expect([a.hp, b.hp, c.hp, d.hp]).toEqual([shots(8), shots(5), shots(5), shots(5)]);
    expect(world.playerBullets.at(0).spent).toBe(true);
    expect(rules.hits).toBe(3);
  });

  it('hits a body it overlaps for several steps only once', () => {
    const world = new World();
    const gunner = enemyAt(world, GUNNER, 100, 100);
    world.spawnPlayerBullet(100, 100, BOLT);
    const rules = new Rules();
    for (let i = 0; i < 3; i += 1) CollisionResolver.resolve(world, rules);
    expect(gunner.hp).toBe(50);
    expect(world.playerBullets.at(0).spent).toBe(false);
  });

  it('kills a Popcorn with one level-1 Spread bullet', () => {
    const world = new World();
    const popcorn = enemyAt(world, POPCORN, 100, 100);
    world.spawnPlayerBullet(100, 100, SHOT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.destroyed).toEqual([popcorn.serial]);
  });
});

describe('CollisionResolver — bullet memory and every level (GDD v0.8 §4.3)', () => {
  it('forgets the bodies of a released bolt: a reused slot hits that Gunner again', () => {
    const world = new World();
    const gunner = enemyAt(world, GUNNER, 100, 100);
    // Harmless bolts, so the Gunner survives them all.
    const bolt: ShotSpec = { ...SHOT, height: 48, damage: 0, pierce: 1, weapon: WeaponKind.Laser };
    for (let i = 0; i < PLAYER_BULLET_POOL_SIZE; i += 1) world.spawnPlayerBullet(100, 100, bolt);
    // Every slot now remembers the Gunner: whichever slot the next shot reuses, it remembers it.
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    for (let i = 0; i < world.playerBullets.count; i += 1) world.playerBullets.at(i).spent = true;
    world.sweep();
    expect(gunner.hp).toBe(shots(8));
    world.spawnPlayerBullet(100, 100, SHOT);
    CollisionResolver.resolve(world, rules);
    expect(gunner.hp).toBe(shots(7));
  });

  it.each([WeaponKind.Spread, WeaponKind.Laser])(
    'kills a Popcorn in one hit with every %s shot of every level',
    (kind) => {
      for (const level of WEAPONS[kind]) {
        for (const shot of level.shots) {
          const world = new World();
          const popcorn = enemyAt(world, POPCORN, 100, 100);
          world.spawnPlayerBullet(100, 100, shot);
          const rules = new Rules();
          CollisionResolver.resolve(world, rules);
          expect(rules.destroyed).toEqual([popcorn.serial]);
        }
      }
    },
  );
});

describe('CollisionResolver — Laser hits in travel order (GDD v0.8 §4.3)', () => {
  it('hits the stacked enemies nearest the ship first, whatever the list order', () => {
    const world = new World();
    // Inserted far to near: the list order is the opposite of the travel order.
    const far = enemyAt(world, GUNNER, 100, 64);
    const middle = enemyAt(world, GUNNER, 100, 84);
    const near = enemyAt(world, GUNNER, 100, 104);
    const bolt: ShotSpec = { ...SHOT, height: 48, pierce: 1, weapon: WeaponKind.Laser };
    world.spawnPlayerBullet(100, 84, bolt);
    world.playerBullets.at(0).velocity.y = -600;
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([near.hp, middle.hp, far.hp]).toEqual([shots(7), shots(7), shots(8)]);
    expect(world.playerBullets.at(0).spent).toBe(true);
  });
});

describe('CollisionResolver — the shield absorbs (GDD v0.8 §4.4)', () => {
  /** A vulnerable world whose ship holds a shield charge. */
  function shieldedWorld(): World {
    const world = vulnerableWorld();
    world.player.collect(PickupKind.Shield);
    return world;
  }

  it('consumes the bullet it absorbed and reports the broken shield, not a death', () => {
    const world = shieldedWorld();
    world.spawnEnemyBullet(120, 272, 0, 75);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, rules.deaths]).toEqual([1, 0]);
    expect(world.enemyBullets.at(0).spent).toBe(true);
  });

  it('leaves a body it absorbed alive', () => {
    const world = shieldedWorld();
    const gunner = enemyAt(world, GUNNER, 120, 272);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, gunner.spent]).toEqual([1, false]);
  });

  it('ignores a second hazard in the same step: the ship is already invulnerable', () => {
    const world = shieldedWorld();
    world.spawnEnemyBullet(120, 272, 0, 75);
    world.spawnEnemyBullet(121, 272, 0, 75);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, rules.deaths]).toEqual([1, 0]);
    expect(world.enemyBullets.at(1).spent).toBe(false);
  });
});

describe('CollisionResolver — the boss (ADR-0022 decision 5, GDD v0.10 §6)', () => {
  /** A boss in `state`, its body over (120, 100). */
  function bossIn(state: BossState, world = vulnerableWorld()): World {
    world.boss.start(CRUISER, world.takeSerial());
    world.boss.state = state;
    world.boss.position.x = 120;
    world.boss.position.y = 100;
    return world;
  }

  it('hands a shot that meets the fighting boss to damageBoss and consumes the bullet', () => {
    const world = bossIn(BossState.Fighting);
    world.spawnPlayerBullet(120, 100, SHOT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.bossDamage).toEqual([shots(1)]);
    expect(world.playerBullets.at(0).spent).toBe(true);
  });

  it.each([BossState.Warning, BossState.Entering, BossState.Destroyed, BossState.Fleeing])(
    'lets a shot pass through the boss in %s',
    (state) => {
      const world = bossIn(state);
      world.spawnPlayerBullet(120, 100, SHOT);
      const rules = new Rules();
      CollisionResolver.resolve(world, rules);
      expect(rules.bossDamage).toEqual([]);
      expect(world.playerBullets.at(0).spent).toBe(false);
    },
  );

  it('hits the boss once per Laser bolt, by serial, however many steps the bolt overlaps it', () => {
    const world = bossIn(BossState.Fighting);
    const bolt: ShotSpec = { ...SHOT, height: 48, pierce: 2, weapon: WeaponKind.Laser };
    world.spawnPlayerBullet(120, 100, bolt);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    CollisionResolver.resolve(world, rules);
    expect(rules.bossDamage).toHaveLength(1);
    expect(world.playerBullets.at(0).spent).toBe(false);
  });

  it('meets the boss and an enemy in the order of the bolt path, nearest first', () => {
    const world = bossIn(BossState.Fighting);
    const gunner = enemyAt(world, GUNNER, 120, 130);
    const bolt: ShotSpec = { ...SHOT, height: 120, pierce: 1, weapon: WeaponKind.Laser };
    world.spawnPlayerBullet(120, 100, bolt);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    // The bolt flies up: the boss (y 100) is met after the gunner (y 130), which is nearer.
    expect(rules.hits).toBe(1);
    expect(gunner.hp).toBe(shots(8) - SHOT.damage);
    expect(rules.bossDamage).toHaveLength(1);
  });

  it.each([BossState.Entering, BossState.Fighting])('hurts the ship by contact in %s', (state) => {
    const world = bossIn(state);
    world.boss.position.y = 272;
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.deaths).toBe(1);
  });

  it.each([BossState.Warning, BossState.Destroyed, BossState.Fleeing])(
    'is harmless to the ship in %s',
    (state) => {
      const world = bossIn(state);
      world.boss.position.y = 272;
      const rules = new Rules();
      CollisionResolver.resolve(world, rules);
      expect(rules.deaths).toBe(0);
    },
  );
});
