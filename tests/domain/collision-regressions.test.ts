import { describe, expect, it } from 'vitest';
import { NoAttack } from '../../src/domain/game/attacks';
import { BossState } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import type { AttackPattern } from '../../src/domain/game/attacks';
import { CollisionResolver } from '../../src/domain/game/collision';
import type { HitRules } from '../../src/domain/game/collision';
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
import { World } from '../../src/domain/game/world';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import { testScript } from '../support/script';

// Regressions of the owner's playtest (#106, #107): the unit rules, then the real run, headless.
const DT = 1 / 60;
const REST = { x: PlayerTuning.spawnX, y: PlayerTuning.restY };

/** The run's side of the collisions: counts only. */
class Rules implements HitRules {
  hits = 0;
  deaths = 0;
  enemyHit(): void {
    this.hits += 1;
  }
  destroyEnemy(enemy: Enemy): void {
    enemy.spent = true;
  }
  playerDied(): void {
    this.deaths += 1;
  }
  absorbed = 0;
  shieldBroken(): void {
    this.absorbed += 1;
  }
  readonly collected: number[] = [];
  pickupCollected(pickup: Pickup): void {
    this.collected.push(pickup.kind);
  }
  bossHits = 0;
  damageBoss(): void {
    this.bossHits += 1;
  }
}

/** A world whose ship is vulnerable at its resting point. */
function vulnerableWorld(): World {
  const world = new World();
  const idle = createIntentFrame();
  for (let i = 0; i < 120; i += 1) {
    world.player.update(idle, DT, world);
    world.player.advanceTimers();
  }
  return world;
}

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

function enemyAt(world: World, archetype: EnemyArchetype, x: number, y: number): Enemy {
  world.spawnEnemy({ at: 0, archetype, count: 1, spawn: { x, y } }, undefined);
  return world.enemies.at(world.enemies.count - 1);
}

describe('#106 — only the 4 × 4 hitbox kills, never the drawn wings (GDD §4.1)', () => {
  // The ship is drawn 32 × 24; a 4 × 4 enemy bullet kills while |Δx| < 4 and |Δy| < 4.
  it.each([
    ['the left wing tip', -15, 0],
    ['the right wing tip', 15, 0],
    ['mid left wing', -8, 0],
    ['mid right wing', 8, 2],
    ['the nose', 0, -10],
    ['the tail', 0, 10],
    ['grazing the hitbox corner', 4, 4],
  ])('a bullet resting on %s leaves the ship alive', (_label, dx, dy) => {
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
    ['3.9 px right', 3.9, 0],
    ['3.9 px up-left', -3.9, -3.9],
  ])('a bullet on %s of the cockpit kills the ship', (_label, dx, dy) => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(REST.x + dx, REST.y + dy, 0, 0);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(world.player.state).toBe(PlayerState.Dead);
    expect(rules.deaths).toBe(1);
  });

  it('cannot tunnel: the fastest relative speed moves less per step than the overlap window', () => {
    const fastestBullet = Math.max(
      EnemyBulletTuning.speed,
      HeavyTuning.fanSpeed,
      HeavyTuning.ringSpeed,
      CruiserTuning.phase1.fanSpeed,
      CruiserTuning.phase1.ringSpeed,
      CruiserTuning.phase2.ringSpeed,
      CruiserTuning.phase2.tripleSpeed,
    );
    const perStep = (fastestBullet + PlayerTuning.maxSpeed) * DT;
    expect(perStep).toBeLessThan(PlayerTuning.hitboxSize + EnemyBulletTuning.size);
  });

  it('kills a ship rushing at full speed into a bullet crossing its path, whatever the angle', () => {
    for (let degrees = 0; degrees < 360; degrees += 15) {
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
      expect(rules.deaths, `at ${String(degrees)}°`).toBe(1);
    }
  });

  it('lets a bullet through while the ship is invulnerable, then kills once it is not', () => {
    const world = new World();
    const idle = createIntentFrame();
    for (let i = 0; i < 60; i += 1) {
      world.player.update(idle, DT, world);
      world.player.advanceTimers();
    }
    expect(world.player.state).toBe(PlayerState.Invulnerable);
    world.spawnEnemyBullet(REST.x, REST.y, 0, 0);
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect(rules.deaths).toBe(0);
    for (let i = 0; i < 60; i += 1) world.player.advanceTimers();
    CollisionResolver.resolve(world, rules);
    expect(rules.deaths).toBe(1);
  });
});

describe('#107 — a Laser bolt stops on the first body it touches (GDD v0.24 §4.3)', () => {
  it.each([1, 2, 3, 4, 5])(
    'at level %i a bolt crossing two overlapping enemies hits only the nearer, then is spent',
    (level) => {
      const shot = WEAPONS[WeaponKind.Laser][level - 1]?.shots[0];
      if (shot === undefined) throw new Error('no Laser shot');
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

  it.each([
    ['an enemy in front of the boss takes the bolt, the boss nothing', 130, 1, 0],
    ['the boss in front of an enemy takes the bolt, the enemy nothing', 70, 0, 1],
  ])('%s', (_label, enemyY, enemyHits, bossHits) => {
    const shot = WEAPONS[WeaponKind.Laser][4]?.shots[0];
    if (shot === undefined) throw new Error('no Laser shot');
    const world = new World();
    world.boss.start(CRUISER, world.takeSerial());
    world.boss.state = BossState.Fighting;
    world.boss.position.x = 120;
    world.boss.position.y = 100;
    enemyAt(world, standing(1000), 120, enemyY);
    world.spawnPlayerBullet(120, 100, { ...shot, height: 120 });
    const rules = new Rules();
    CollisionResolver.resolve(world, rules);
    expect([rules.hits, rules.bossHits]).toEqual([enemyHits, bossHits]);
    expect(world.playerBullets.at(0).spent).toBe(true);
  });

  it('reaches the farther enemy only with the next bolt, once the nearer is destroyed', () => {
    const shot = WEAPONS[WeaponKind.Laser][4]?.shots[0];
    if (shot === undefined) throw new Error('no Laser shot');
    const world = new World();
    const far = enemyAt(world, standing(1000), 120, 90);
    enemyAt(world, standing(shot.damage), 120, 110);
    world.spawnPlayerBullet(120, 110, shot);
    world.spawnPlayerBullet(120, 110, shot);
    CollisionResolver.resolve(world, new Rules());
    expect(far.hp).toBe(1000 - shot.damage);
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
        if (ticks === at) spawn.spawnEnemyBullet(self.position.x, self.position.y, 0, 85);
      },
    };
  }

  /** A run whose only enemy stands at (x, 200) and drops one bullet once the ship is vulnerable. */
  function bulletRun(x: number): Run {
    const archetype = standing(1000, dropOnce(130));
    return new Run({
      seed: 1,
      levels: [testScript([{ at: 0, archetype, count: 1, spawn: { x, y: 200 } }])],
    });
  }

  it.each([
    [REST.x + 12, PlayerState.Vulnerable],
    [REST.x - 12, PlayerState.Vulnerable],
    [REST.x + 3, PlayerState.Dead],
  ])('a bullet falling at x %d through the idle ship leaves it %s', (x, state) => {
    const run = bulletRun(x);
    const idle = createIntentFrame();
    for (let i = 0; i < 260; i += 1) run.step(DT, idle);
    expect(run.snapshot().player.state).toBe(state);
  });

  it('replays the wing graze identically from the same seed', () => {
    const states: string[] = [];
    for (let k = 0; k < 2; k += 1) {
      const run = bulletRun(REST.x + 12);
      const idle = createIntentFrame();
      for (let i = 0; i < 260; i += 1) run.step(DT, idle);
      states.push(`${run.snapshot().player.state}:${String(run.snapshot().enemyBullets.count)}`);
    }
    expect(states[0]).toBe(states[1]);
  });

  it('never touches the farther of two stacked enemies while a level-5 Laser fires for 2 s', () => {
    const near = standing(100_000);
    const far = standing(100_000);
    const run = new Run({
      seed: 1,
      levels: [
        testScript([
          { at: 0, archetype: far, count: 1, spawn: { x: REST.x, y: 120 } },
          { at: 0, archetype: near, count: 1, spawn: { x: REST.x, y: 140 } },
        ]),
      ],
    });
    const blue = new Pickup();
    blue.spawn(PickupKind.PBlue, 0, 0, 1);
    for (let i = 0; i < 5; i += 1) run.rules.pickupCollected(blue);
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 150; i += 1) run.step(DT, fire);
    const enemies = run.snapshot().enemies;
    const hp = [enemies.at(0).hp, enemies.at(1).hp];
    expect(hp[0]).toBe(100_000);
    expect(hp[1]).toBeLessThan(100_000);
  });
});
