import { describe, expect, it } from 'vitest';
import { CollisionResolver } from '../../src/domain/game/collision';
import { BossState } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import { DIVER, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import { PickupKind } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import { WEAPONS, WeaponKind } from '../../src/domain/game/weapon';
import type { ShotSpec } from '../../src/domain/game/weapon';
import {
  EnemyBulletTuning,
  PLAYER_BULLET_POOL_SIZE,
  PlayerTuning,
} from '../../src/domain/game/tuning';
import { World } from '../../src/domain/game/world';
import { createIntentFrame } from '../../src/domain/ports/input-port';
import { enemyAt, Rules, vulnerableWorld } from '../support/collision';
import { shots } from '../support/shots';

const DT = 1 / 60;
/** Read from the archetype so a rebalance of its HP does not break the damage arithmetic below. */
const GUNNER_HP = GUNNER.stats.hp;
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

describe('CollisionResolver — shots against enemies (GDD §5.2, class diagram)', () => {
  it('lowers the HP by the shot damage, consumes the bullet and reports the hit', () => {
    const world = new World();
    const gunner = enemyAt(world, GUNNER, 100, 100);
    world.spawnPlayerBullet(100, 100, SHOT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(gunner.hp).toBe(GUNNER_HP - shots(1));
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

describe('CollisionResolver — hazards against the 6 × 6 hitbox (GDD v0.24 §4.1, §4.4)', () => {
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
    world.spawnEnemyBullet(120 + 6, 272, 0, 75); // 4 px wide: reaches x 124, the hitbox ends at 123
    CollisionResolver.resolve(world, new Rules());
    expect(world.player.state).toBe(PlayerState.Vulnerable);
  });

  it('ignores an enemy body that touches the sprite but not the hitbox', () => {
    const world = vulnerableWorld();
    enemyAt(world, DIVER, 120 + 12, 272); // 16 px wide: reaches x 124, the hitbox ends at 123
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
    expect(gunner.hp).toBe(GUNNER_HP);
  });
});

describe('CollisionResolver — the pass-through memory, on shots whose data sets one (ADR-0019)', () => {
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
    expect([a.hp, b.hp, c.hp, d.hp]).toEqual([
      GUNNER_HP,
      GUNNER_HP - shots(3),
      GUNNER_HP - shots(3),
      GUNNER_HP - shots(3),
    ]);
    expect(world.playerBullets.at(0).spent).toBe(true);
    expect(rules.hits).toBe(3);
  });

  it('hits a body it overlaps for several steps only once', () => {
    const world = new World();
    const gunner = enemyAt(world, GUNNER, 100, 100);
    world.spawnPlayerBullet(100, 100, BOLT);
    const rules = new Rules();
    for (let i = 0; i < 3; i += 1) CollisionResolver.resolve(world, rules);
    expect(gunner.hp).toBe(GUNNER_HP - shots(3));
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
    expect(gunner.hp).toBe(GUNNER_HP);
    world.spawnPlayerBullet(100, 100, SHOT);
    CollisionResolver.resolve(world, rules);
    expect(gunner.hp).toBe(GUNNER_HP - shots(1));
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

describe('CollisionResolver — hits in travel order (GDD v0.8 §4.3)', () => {
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
    expect([near.hp, middle.hp, far.hp]).toEqual([
      GUNNER_HP - shots(1),
      GUNNER_HP - shots(1),
      GUNNER_HP,
    ]);
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

describe('CollisionResolver — the ring is the shape while a charge is held (GDD v0.19 §4.4)', () => {
  // The ship rests at (120, 272); the ring is 36 × 36 and an enemy bullet 4 × 4, so a bullet
  // centre closer than 18 + 2 = 20 px on both axes overlaps the ring, strictly.
  const REACH = PlayerTuning.shieldSize / 2 + EnemyBulletTuning.size / 2;

  function shieldedWorld(): World {
    const world = vulnerableWorld();
    world.player.collect(PickupKind.Shield);
    return world;
  }

  it.each([
    ['a corner', 120 + REACH - 1, 272 + REACH - 1],
    ['an edge', 120 - REACH + 1, 272],
    ['the inside, off the hitbox', 120, 272 - 10],
  ])('consumes the charge with a bullet overlapping %s of the ring', (_, x, y) => {
    const world = shieldedWorld();
    world.spawnEnemyBullet(x, y, 0, 75);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, rules.deaths, world.player.shield]).toEqual([1, 0, false]);
    expect(world.enemyBullets.at(0).spent).toBe(true);
  });

  it('leaves the charge to a bullet that only shares the ring edge', () => {
    const world = shieldedWorld();
    world.spawnEnemyBullet(120 + REACH, 272, 0, 75);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, rules.deaths, world.player.shield]).toEqual([0, 0, true]);
    expect(world.enemyBullets.at(0).spent).toBe(false);
  });

  it('lets the same bullet pass with no charge: only the 6 × 6 hitbox counts', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(120 + REACH - 1, 272, 0, 75);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, rules.deaths]).toEqual([0, 0]);
    expect(world.enemyBullets.at(0).spent).toBe(false);
  });

  it('absorbs a body touching the ring and leaves it alive', () => {
    const world = shieldedWorld();
    // A 16 × 16 Popcorn reaches the ring when its centre is closer than 18 + 8 = 26 px.
    const popcorn = enemyAt(world, POPCORN, 120 + 25, 272);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, popcorn.spent, world.player.shield]).toEqual([1, false, false]);
  });

  it('protects once only: the next touch of the vanished ring is a near miss again', () => {
    const world = shieldedWorld();
    world.spawnEnemyBullet(120 + REACH - 1, 272, 0, 75);
    CollisionResolver.resolve(world, new Rules());
    world.spawnEnemyBullet(120 + REACH - 1, 272 - 5, 0, 75);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.absorbed, rules.deaths]).toEqual([0, 0]);
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
    expect(gunner.hp).toBe(GUNNER_HP - SHOT.damage);
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

describe('CollisionResolver — the shot box is strict on both axes (overlap rule: |Δ| < half-sums)', () => {
  // A Gunner is 32 × 32 and a Spread shot 2 × 8: the boxes overlap while |Δx| < 17, |Δy| < 20.
  it.each([
    ['level, exactly touching on the right', 117, 100, false],
    ['level, 0.1 px inside on the right', 116.9, 100, true],
    ['level, exactly touching on the left', 83, 100, false],
    ['level, 0.1 px inside on the left', 83.1, 100, true],
    ['centred, exactly touching below', 100, 120, false],
    ['centred, exactly touching above', 100, 80, false],
    ['centred, 0.1 px inside below', 100, 119.9, true],
    ['centred, 0.1 px inside above', 100, 80.1, true],
  ])('a shot %s hits: %s', (_label, x, y, hits) => {
    const world = new World();
    const gunner = enemyAt(world, GUNNER, 100, 100);
    world.spawnPlayerBullet(x, y, SHOT);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.hits).toBe(hits ? 1 : 0);
    expect(gunner.hp).toBe(hits ? GUNNER_HP - shots(1) : GUNNER_HP);
    expect(world.playerBullets.at(0).spent).toBe(hits);
  });
});

describe('CollisionResolver — the 6 × 6 hitbox edge is strict (GDD v0.24 §4.1)', () => {
  // The ship rests at (120, 272); an enemy bullet is 4 × 4: it kills while |Δ| < (6 + 4) / 2 = 5.
  it.each([
    ['exactly at the right edge', 125, 272, false],
    ['exactly at the left edge', 115, 272, false],
    ['exactly at the lower edge', 120, 277, false],
    ['exactly at the upper edge', 120, 267, false],
    ['one pixel inside on the right', 124, 272, true],
    ['one pixel inside on the left', 116, 272, true],
    ['one pixel inside below', 120, 276, true],
    ['one pixel inside above', 120, 268, true],
  ])('an enemy bullet %s: kills the ship = %s', (_label, x, y, kills) => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(x, y, 0, 0);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(world.player.state).toBe(kills ? PlayerState.Dead : PlayerState.Vulnerable);
    expect(rules.deaths).toBe(kills ? 1 : 0);
    expect(world.enemyBullets.at(0).spent).toBe(kills);
  });

  it('keeps the same strict edge for an enemy body: a Diver (16 wide) touching at 11 px passes', () => {
    const touching = vulnerableWorld();
    enemyAt(touching, DIVER, 120 + 11, 272); // (6 + 16) / 2 = 11
    CollisionResolver.resolve(touching, new Rules());
    expect(touching.player.state).toBe(PlayerState.Vulnerable);
    const inside = vulnerableWorld();
    enemyAt(inside, DIVER, 120 + 10, 272);
    CollisionResolver.resolve(inside, new Rules());
    expect(inside.player.state).toBe(PlayerState.Dead);
  });
});

describe('CollisionResolver — the pickup collection box edge is strict (GDD §4.6)', () => {
  // The 32 × 32 sprite box catches a 16 × 16 pickup while |Δ| < (32 + 16) / 2 = 24.
  it.each([
    ['exactly touching on the right', 144, 272, false],
    ['exactly touching on the left', 96, 272, false],
    ['exactly touching below', 120, 296, false],
    ['exactly touching above', 120, 248, false],
    ['1 px inside on the right', 143, 272, true],
    ['1 px inside on the left', 97, 272, true],
    ['1 px inside below', 120, 295, true],
    ['1 px inside above', 120, 249, true],
  ])('a pickup %s is caught = %s', (_label, x, y, caught) => {
    const world = vulnerableWorld();
    world.spawnPickup(PickupKind.PBlue, x, y);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.collected).toEqual(caught ? [PickupKind.PBlue] : []);
    expect(world.pickups.at(0).spent).toBe(caught);
  });
});

describe('CollisionResolver — the boss and a Laser bolt (GDD v0.8 §4.3, ADR-0022 decision 5)', () => {
  function fightingBoss(): World {
    const world = vulnerableWorld();
    world.boss.start(CRUISER, world.takeSerial());
    world.boss.state = BossState.Fighting;
    world.boss.position.x = 120;
    world.boss.position.y = 100;
    return world;
  }
  const BOLT: ShotSpec = { ...SHOT, height: 48, pierce: 2, weapon: WeaponKind.Laser };

  it('spends one pass-through on the boss and remembers its serial', () => {
    const world = fightingBoss();
    world.spawnPlayerBullet(120, 100, BOLT);
    CollisionResolver.resolve(world, new Rules());
    const bolt = world.playerBullets.at(0);
    expect(bolt.pierceLeft).toBe(1);
    expect(bolt.canHit(world.boss.serial)).toBe(false);
    expect(bolt.spent).toBe(false);
  });

  it('is spent by the boss when it has no pass-through left, and remembers nothing', () => {
    const world = fightingBoss();
    world.spawnPlayerBullet(120, 100, { ...BOLT, pierce: 0 });
    CollisionResolver.resolve(world, new Rules());
    const bolt = world.playerBullets.at(0);
    expect([bolt.spent, bolt.pierceLeft, bolt.canHit(world.boss.serial)]).toEqual([true, 0, true]);
  });

  describe('one shot overlapping an enemy and the boss hits the nearer along its path', () => {
    const WIDE: ShotSpec = { ...SHOT, height: 120, width: 120, pierce: 0 };
    // [label, shot velocity, enemy x, enemy y, the enemy is hit (else the boss)]
    it.each([
      ['flying up, enemy below the boss', 0, -360, 120, 130, true],
      ['flying up, enemy above the boss', 0, -360, 120, 70, false],
      ['flying right, enemy left of the boss', 360, 0, 90, 100, true],
      ['flying right, enemy right of the boss', 360, 0, 150, 100, false],
      ['flying left, enemy right of the boss', -360, 0, 150, 100, true],
      ['flying left, enemy left of the boss', -360, 0, 90, 100, false],
    ])('%s', (_label, vx, vy, x, y, enemyFirst) => {
      const world = fightingBoss();
      const gunner = enemyAt(world, GUNNER, x, y);
      world.spawnPlayerBullet(120, 100, { ...WIDE, vxPerSecond: vx, vyPerSecond: vy });
      const rules = new Rules();
      CollisionResolver.resolve(world, rules);
      expect(rules.hits).toBe(enemyFirst ? 1 : 0);
      expect(gunner.hp).toBe(enemyFirst ? GUNNER_HP - SHOT.damage : GUNNER_HP);
      expect(rules.bossDamage).toHaveLength(enemyFirst ? 0 : 1);
      expect(world.playerBullets.at(0).spent).toBe(true);
    });
  });
});

describe('CollisionResolver — a death and an absorbed hit are reported apart (GDD v0.8 §4.4)', () => {
  it('reports a death without a shield as a death only: the shield is not broken', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(120, 272, 0, 0);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.deaths, rules.absorbed]).toEqual([1, 0]);
  });

  it('reports a body contact without a shield as a death only', () => {
    const world = vulnerableWorld();
    enemyAt(world, GUNNER, 120, 272);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.deaths, rules.absorbed]).toEqual([1, 0]);
  });

  it('reports a hit the shield absorbed as a broken shield only, from a bullet and from the boss', () => {
    const bullet = vulnerableWorld();
    bullet.player.collect(PickupKind.Shield);
    bullet.spawnEnemyBullet(120, 272, 0, 0);
    const first = new Rules();
    CollisionResolver.resolve(bullet, first);
    expect([first.deaths, first.absorbed]).toEqual([0, 1]);

    const boss = vulnerableWorld();
    boss.player.collect(PickupKind.Shield);
    boss.boss.start(CRUISER, boss.takeSerial());
    boss.boss.state = BossState.Fighting;
    boss.boss.position.x = 120;
    boss.boss.position.y = 272;
    const second = new Rules();
    CollisionResolver.resolve(boss, second);
    expect([second.deaths, second.absorbed]).toEqual([0, 1]);
  });
});
