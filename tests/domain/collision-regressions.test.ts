import { describe, expect, it } from 'vitest';
import type { ReadonlyActiveList } from '../../src/domain/game/active-list';
import { NoAttack } from '../../src/domain/game/attacks';
import type { AttackPattern } from '../../src/domain/game/attacks';
import { BossState } from '../../src/domain/game/boss';
import { CollisionResolver } from '../../src/domain/game/collision';
import { CRUISER } from '../../src/domain/game/cruiser';
import { SizeTier } from '../../src/domain/game/enemy';
import type { Enemy, EnemyArchetype } from '../../src/domain/game/enemy';
import { Pickup, PickupKind } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import { Run } from '../../src/domain/game/run';
import {
  CruiserTuning,
  EnemyBulletTuning,
  HeavyTuning,
  PlayerTuning,
} from '../../src/domain/game/tuning';
import { WEAPONS, WeaponKind } from '../../src/domain/game/weapon';
import type { ShotSpec } from '../../src/domain/game/weapon';
import { World } from '../../src/domain/game/world';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import { enemyAt, Rules, STEPS_TO_VULNERABLE, vulnerableWorld } from '../support/collision';
import { testScript } from '../support/script';

// Regressions of the owner's playtest (#106, #107): the unit rules, then the real run, headless.
const DT = 1 / 60;
const REST = { x: PlayerTuning.spawnX, y: PlayerTuning.restY };
/** A 4 × 4 enemy bullet kills while |Δx| and |Δy| are both under this (GDD v0.24 §4.1). */
const KILL_REACH = (PlayerTuning.hitboxSize + EnemyBulletTuning.size) / 2;

/** A target that never moves; `hp` in tenths of a level-1 shot. */
function standing(hp: number, attack: AttackPattern = NoAttack): EnemyArchetype {
  return {
    id: 'gunner',
    stats: { hp, width: 32, height: 32, score: 0, tier: SizeTier.Medium },
    movement: { tick: () => undefined },
    attack,
    formation: false,
    drops: { rate: 0, kinds: [] },
    carriesCargo: false,
  };
}

/** The Laser bolt of `level`, from the real table. */
function laserShot(level: number): ShotSpec {
  const shot = WEAPONS[WeaponKind.Laser][level - 1]?.shots[0];
  if (shot === undefined) throw new Error(`no Laser shot at level ${String(level)}`);
  return shot;
}

/** The live enemy at height `y`: looked up by position, never by the active list's order. */
function enemyAtY(enemies: ReadonlyActiveList<Enemy>, y: number): Enemy {
  for (let i = 0; i < enemies.count; i += 1) {
    if (enemies.at(i).position.y === y) return enemies.at(i);
  }
  throw new Error(`no enemy at y ${String(y)}`);
}

describe('#106 — the 6 × 6 body core kills, the drawn wings do not (GDD v0.24 §4.1)', () => {
  it('reaches 5 px from the centre: the 6 × 6 core plus half a 4 × 4 bullet', () => {
    expect(KILL_REACH).toBe(5);
  });

  // The ship is drawn 32 × 24 around its centre.
  it.each([
    ['the left wing tip', -15, 0],
    ['the right wing, 8 px out', 8, 2],
    ['the nose', 0, -10],
    ['the core corner, exactly touching', 5, 5],
    ['the core side, exactly touching', -5, 0],
  ])('a bullet on %s leaves the ship alive', (_label, dx, dy) => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(REST.x + dx, REST.y + dy, 0, 0);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(world.player.state).toBe(PlayerState.Vulnerable);
    expect(rules.deaths).toBe(0);
    expect(world.enemyBullets.at(0).spent).toBe(false);
  });

  it.each([
    ['the centre', 0, 0],
    ['the core side, 0.1 px inside', 4.9, 0],
    ['the core corner, 0.1 px inside', -4.9, -4.9],
    ['4 px out, killed since v0.24 (missed by the 4 × 4 box)', 4, 0],
  ])('a bullet on %s kills the ship', (_label, dx, dy) => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(REST.x + dx, REST.y + dy, 0, 0);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(world.player.state).toBe(PlayerState.Dead);
    expect(rules.deaths).toBe(1);
    expect(world.enemyBullets.at(0).spent).toBe(true);
  });

  it('cannot tunnel: the fastest relative speed moves less per step than the overlap window', () => {
    // Every enemy bullet speed of the tuning: a new, faster bullet must be added here.
    const fastestBullet = Math.max(
      EnemyBulletTuning.speed,
      HeavyTuning.fanSpeed,
      HeavyTuning.ringSpeed,
      CruiserTuning.phase1.fanSpeed,
      CruiserTuning.phase1.ringSpeed,
      CruiserTuning.phase2.ringSpeed,
      CruiserTuning.phase2.tripleSpeed,
    );
    expect((fastestBullet + PlayerTuning.maxSpeed) * DT).toBeLessThan(2 * KILL_REACH);
  });

  it.each(Array.from({ length: 24 }, (_, k) => k * 15))(
    'kills a ship rushing at full speed into a bullet crossing its centre at %i°',
    (degrees) => {
      const world = vulnerableWorld();
      const a = (degrees * Math.PI) / 180;
      const vx = EnemyBulletTuning.speed * Math.cos(a);
      const vy = EnemyBulletTuning.speed * Math.sin(a);
      // The bullet starts 40 steps away on its line through the ship's centre; the ship comes
      // straight at it, so the relative speed is the largest possible.
      world.spawnEnemyBullet(REST.x - vx * 40 * DT, REST.y - vy * 40 * DT, vx, vy);
      const frame = createIntentFrame();
      frame.moveKind = 'direction';
      const rules = new Rules();
      for (let i = 0; i < 80 && rules.deaths === 0; i += 1) {
        const bullet = world.enemyBullets.at(0).position;
        const dx = bullet.x - world.player.position.x;
        const dy = bullet.y - world.player.position.y;
        const d = Math.hypot(dx, dy) || 1;
        frame.moveX = dx / d;
        frame.moveY = dy / d;
        world.player.update(frame, DT, world);
        world.moveBullets(DT);
        CollisionResolver.resolve(world, rules);
      }
      expect(rules.deaths).toBe(1);
    },
  );

  it('lets a bullet through the core while the ship is invulnerable, then kills once it is not', () => {
    const world = vulnerableWorld(STEPS_TO_VULNERABLE - 1);
    expect(world.player.state).toBe(PlayerState.Invulnerable);
    world.spawnEnemyBullet(REST.x, REST.y, 0, 0);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.deaths).toBe(0);
    world.player.advanceTimers();
    expect(world.player.state).toBe(PlayerState.Vulnerable);
    CollisionResolver.resolve(world, rules);
    expect(rules.deaths).toBe(1);
  });
});

describe('#107 — a Laser bolt stops on the first body it touches (GDD v0.24 §4.3)', () => {
  it.each([1, 2, 3, 4, 5])(
    'at level %i a bolt crossing two overlapping enemies hits only the nearer, then is spent',
    (level) => {
      const shot = laserShot(level);
      const world = new World();
      const far = enemyAt(world, standing(1000), 120, 90);
      const near = enemyAt(world, standing(1000), 120, 110);
      world.spawnPlayerBullet(120, 110, shot);
      const rules = new Rules();
      CollisionResolver.resolve(world, rules);
      expect([near.hp, far.hp]).toEqual([1000 - shot.damage, 1000]);
      expect(rules.hits).toBe(1);
      expect(world.playerBullets.at(0).spent).toBe(true);
    },
  );

  it('kills the nearer enemy without touching the farther; only the next bolt reaches it', () => {
    const shot = laserShot(5);
    const world = new World();
    const far = enemyAt(world, standing(1000), 120, 90);
    const near = enemyAt(world, standing(shot.damage), 120, 110);
    world.spawnPlayerBullet(120, 110, shot);
    CollisionResolver.resolve(world, new Rules());
    expect([near.spent, far.hp]).toEqual([true, 1000]);
    world.spawnPlayerBullet(120, 110, shot);
    CollisionResolver.resolve(world, new Rules());
    expect(far.hp).toBe(1000 - shot.damage);
  });

  // The bolt is stretched to 120 px so it overlaps the boss and the enemy in the same step: the
  // test is about which one it meets first, not about the real 48 px length.
  it.each([
    ['an enemy in front of the boss takes the bolt, the boss nothing', 130, 1, 0],
    ['the boss in front of an enemy takes the bolt, the enemy nothing', 70, 0, 1],
  ])('%s', (_label, enemyY, enemyHits, bossHits) => {
    const world = new World();
    world.boss.start(CRUISER, world.takeSerial());
    world.boss.state = BossState.Fighting;
    world.boss.position.x = 120;
    world.boss.position.y = 100;
    enemyAt(world, standing(1000), 120, enemyY);
    world.spawnPlayerBullet(120, 100, { ...laserShot(5), height: 120 });
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.hits, rules.bossDamage.length]).toEqual([enemyHits, bossHits]);
    expect(world.playerBullets.at(0).spent).toBe(true);
  });
});

describe('the playtest regressions in a real run, headless (#106, #107)', () => {
  /** An attack that drops one bullet straight down at step `at` of the enemy's life. */
  function dropOnce(at: number): AttackPattern {
    let ticks = 0;
    return {
      fire: () => undefined,
      tick(self, _world, spawn): void {
        ticks += 1;
        if (ticks === at) {
          spawn.spawnEnemyBullet(self.position.x, self.position.y, 0, EnemyBulletTuning.speed);
        }
      },
    };
  }

  /**
   * An idle ship under one enemy standing at (x, 200), which drops one bullet once the ship is
   * vulnerable. Returns the ship's state and whether the bullet crossed the ship's row alive, so a
   * survival is never a bullet that did not arrive.
   */
  function bulletRun(x: number): { state: PlayerState; crossed: boolean } {
    const archetype = standing(1000, dropOnce(STEPS_TO_VULNERABLE + 10));
    const run = new Run({
      seed: 1,
      levels: [testScript([{ at: 0, archetype, count: 1, spawn: { x, y: 200 } }])],
    });
    const idle = createIntentFrame();
    const bullets = run.snapshot().enemyBullets;
    let crossed = false;
    for (let i = 0; i < 260; i += 1) {
      run.step(DT, idle);
      if (bullets.count > 0 && bullets.at(0).position.y > REST.y) crossed = true;
    }
    return { state: run.snapshot().player.state, crossed };
  }

  it.each([
    ['the right wing', REST.x + 12, PlayerState.Vulnerable, true],
    ['the left wing', REST.x - 12, PlayerState.Vulnerable, true],
    ['just outside the core', REST.x + KILL_REACH, PlayerState.Vulnerable, true],
    ['the core', REST.x + KILL_REACH - 1, PlayerState.Dead, false],
  ])('a bullet falling through %s leaves the idle ship %s', (_label, x, state, crossed) => {
    expect(bulletRun(x)).toEqual({ state, crossed });
  });

  it('never touches the farther of two stacked enemies while a level-5 Laser fires for 2 s', () => {
    const run = new Run({
      seed: 1,
      levels: [
        testScript([
          { at: 0, archetype: standing(100_000), count: 1, spawn: { x: REST.x, y: 120 } },
          { at: 0, archetype: standing(100_000), count: 1, spawn: { x: REST.x, y: 140 } },
        ]),
      ],
    });
    const blue = new Pickup();
    blue.spawn(PickupKind.PBlue, 0, 0, 1);
    for (let i = 0; i < 5; i += 1) run.rules.pickupCollected(blue);
    expect([run.snapshot().weaponKind, run.snapshot().power]).toEqual([WeaponKind.Laser, 5]);
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 150; i += 1) run.step(DT, fire);
    const enemies = run.snapshot().enemies;
    expect(enemyAtY(enemies, 120).hp).toBe(100_000);
    expect(enemyAtY(enemies, 140).hp).toBeLessThan(100_000);
  });
});
