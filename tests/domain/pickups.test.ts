import { describe, expect, it } from 'vitest';
import { CollisionResolver } from '../../src/domain/game/collision';
import type { HitRules } from '../../src/domain/game/collision';
import { Enemy, GUNNER, HEAVY_RING, POPCORN, SizeTier } from '../../src/domain/game/enemy';
import type { EnemyArchetype } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import { Formation } from '../../src/domain/game/formation';
import { LevelDirector } from '../../src/domain/game/level-director';
import type { EnemySpawner } from '../../src/domain/game/level-director';
import { LEVEL_1 } from '../../src/domain/game/level-script';
import type { LevelScript, ScriptEvent } from '../../src/domain/game/level-script';
import { Pickup, PickupKind } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import { Run } from '../../src/domain/game/run';
import {
  ENEMY_POOL_SIZE,
  FORMATION_POOL_SIZE,
  PICKUP_POOL_SIZE,
  PLAYER_BULLET_POOL_SIZE,
} from '../../src/domain/game/tuning';
import { Weapon, WeaponKind } from '../../src/domain/game/weapon';
import { World } from '../../src/domain/game/world';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { Random } from '../../src/domain/ports/random';
import { mixSeed } from '../../src/domain/random/seeded-random';
import { testScript } from '../support/script';

const DT = 1 / 60;

/** A `Random` that returns the given draws in order, then 0.99 (never a drop). */
function scripted(draws: readonly number[]): Random {
  let index = 0;
  return {
    next: (): number => draws[index++] ?? 0.99,
    seed: (): void => undefined,
  };
}

/** An enemy of `archetype` alive at (x, y), with an optional formation. */
function enemyAt(archetype: typeof POPCORN, x: number, y: number, formation?: Formation): Enemy {
  const enemy = new Enemy();
  enemy.spawn(archetype, { spawn: { x, y } }, 7, formation);
  return enemy;
}

/** Records every event of the given kinds as `kind:detail:value@x,y`. */
function logOf(run: Run, kinds: readonly GameEventKind[]): string[] {
  const log: string[] = [];
  const record = (e: Readonly<GameEvent>): void => {
    log.push(
      `${String(e.kind)}:${String(e.detail)}:${String(e.value)}@${String(e.position.x)},${String(e.position.y)}`,
    );
  };
  for (const kind of kinds) run.events().subscribe(kind, record);
  return log;
}

const SPAWNED = GameEventKind.PickupSpawned;
const CLEARED = GameEventKind.FormationCleared;
const COLLECTED = GameEventKind.PickupCollected;

describe('Pickup — fall and sway (GDD v0.8 §4.6)', () => {
  it('falls at 40 px/s and sways ±8 px over 2 s as a closed form of its age', () => {
    const world = new World();
    world.spawnPickup(PickupKind.PRed, 100, 50);
    const pickup = world.pickups.at(0);
    for (let i = 0; i < 30; i += 1) world.movePickups();
    expect(pickup.position.y).toBeCloseTo(70, 9);
    expect(pickup.position.x).toBeCloseTo(100 + 8, 9); // a quarter period: sin(π / 2)
    for (let i = 0; i < 30; i += 1) world.movePickups();
    expect(pickup.position.y).toBeCloseTo(90, 9);
    expect(pickup.position.x).toBeCloseTo(100, 9);
    expect(pickup.previousPosition.y).toBeCloseTo(90 - 40 / 60, 9);
  });

  it.each([
    [2, 16],
    [235, 224],
    [120, 120],
  ])('clamps a sway axis at %d to %d, so the box stays on the field', (x, axis) => {
    const pickup = new Pickup();
    pickup.spawn(PickupKind.PBlue, x, 0, 1);
    expect(pickup.origin.x).toBe(axis);
    expect(pickup.position.x).toBe(axis);
  });

  it('is lost once its top edge leaves the bottom of the field', () => {
    const world = new World();
    world.spawnPickup(PickupKind.PRed, 120, 300);
    // Top edge at 300 − 8 + 40 t reaches 320 after 0.7 s (42 steps).
    for (let i = 0; i < 41; i += 1) world.movePickups();
    world.sweep();
    expect(world.pickups.count).toBe(1);
    world.movePickups();
    world.sweep();
    expect(world.pickups.count).toBe(0);
  });

  it('refuses a spawn on a full pool of 8 and reports it', () => {
    const world = new World();
    for (let i = 0; i < PICKUP_POOL_SIZE; i += 1) {
      expect(world.spawnPickup(PickupKind.PRed, 100, 0)).toBe(true);
    }
    expect(world.spawnPickup(PickupKind.PRed, 100, 0)).toBe(false);
    expect(world.pickups.count).toBe(PICKUP_POOL_SIZE);
  });
});

describe('Weapon — kind and power level (GDD v0.8 §4.3, §4.6)', () => {
  it('starts with the Spread at level 1', () => {
    const weapon = new Weapon();
    expect([weapon.kind, weapon.level]).toEqual([WeaponKind.Spread, 1]);
  });

  it('raises the level by one per P and selects its weapon, keeping the level', () => {
    const weapon = new Weapon();
    expect(weapon.powerUp(WeaponKind.Spread)).toBe(true);
    expect(weapon.powerUp(WeaponKind.Laser)).toBe(true);
    expect([weapon.kind, weapon.level]).toEqual([WeaponKind.Laser, 3]);
  });

  it('cannot rise past level 5, and an other-colour P still switches', () => {
    const weapon = new Weapon();
    for (let i = 0; i < 4; i += 1) weapon.powerUp(WeaponKind.Spread);
    expect(weapon.level).toBe(5);
    expect(weapon.powerUp(WeaponKind.Spread)).toBe(false);
    expect(weapon.powerUp(WeaponKind.Laser)).toBe(false);
    expect([weapon.kind, weapon.level]).toEqual([WeaponKind.Laser, 5]);
  });

  it('keeps the cooldown on a switch, so switching never fires early', () => {
    const weapon = new Weapon();
    const shots: number[] = [];
    const spawner = { spawnPlayerBullet: (x: number): void => void shots.push(x) };
    weapon.tick({ x: 0, y: 0 }, true, spawner);
    weapon.powerUp(WeaponKind.Laser);
    weapon.tick({ x: 0, y: 0 }, true, spawner);
    expect(shots).toHaveLength(1);
  });
});

/** The run's side of the collisions, recorded. */
class Collected implements HitRules {
  readonly kinds: PickupKind[] = [];
  enemyHit(): void {
    // Not exercised here.
  }
  destroyEnemy(): void {
    // Not exercised here.
  }
  playerDied(): void {
    // Not exercised here.
  }
  pickupCollected(pickup: Pickup): void {
    this.kinds.push(pickup.kind);
  }
  shieldBroken(): void {
    // Not exercised here.
  }
  damageBoss(): void {
    // Not exercised here.
  }
}

/** A world whose ship sits at (120, 272) in `state` after `steps` idle steps. */
function worldAfter(steps: number): World {
  const world = new World();
  const idle = createIntentFrame();
  for (let i = 0; i < steps; i += 1) {
    world.player.update(idle, DT, world);
    world.player.advanceTimers();
  }
  return world;
}

describe('Collisions — pass 4, pickups against the ship (GDD v0.8 §4.6)', () => {
  it('catches a pickup touching the 32 × 32 sprite box, not one just outside it', () => {
    const world = worldAfter(120);
    world.spawnPickup(PickupKind.PRed, 120 + 23.9, 272); // 16 + 8 = 24: overlapping
    world.spawnPickup(PickupKind.PBlue, 120, 272 + 24); // touching only: not caught
    const rules = new Collected();
    CollisionResolver.resolve(world, rules);
    expect(rules.kinds).toEqual([PickupKind.PRed]);
    expect(world.pickups.at(0).spent).toBe(true);
    expect(world.pickups.at(1).spent).toBe(false);
  });

  it('catches while the ship flies in or blinks, never while it is dead', () => {
    const entering = worldAfter(29);
    expect(entering.player.state).toBe(PlayerState.Entering);
    entering.spawnPickup(PickupKind.PRed, 120, entering.player.position.y);
    const rules = new Collected();
    CollisionResolver.resolve(entering, rules);
    expect(rules.kinds).toEqual([PickupKind.PRed]);

    const dead = worldAfter(120);
    dead.player.hit();
    dead.spawnPickup(PickupKind.PRed, 120, 272);
    const none = new Collected();
    CollisionResolver.resolve(dead, none);
    expect(none.kinds).toEqual([]);
  });

  it('catches nothing in the step the ship dies, after the hazards', () => {
    const world = worldAfter(120);
    world.spawnEnemyBullet(120, 272, 0, 0);
    world.spawnPickup(PickupKind.PRed, 120, 272);
    const rules = new Collected();
    CollisionResolver.resolve(world, rules);
    expect(world.player.state).toBe(PlayerState.Dead);
    expect(rules.kinds).toEqual([]);
  });
});

/** Records the formation each spawned member received. */
class FormationRecorder implements EnemySpawner {
  readonly started: number[] = [];
  readonly members: (Formation | undefined)[] = [];
  startFormation(size: number, paysP: boolean): Formation {
    this.started.push(size);
    const formation = new Formation();
    formation.start(size, paysP);
    return formation;
  }
  spawnEnemy(_event: Readonly<ScriptEvent>, formation: Formation | undefined): boolean {
    this.members.push(formation);
    return true;
  }
  startBoss(): void {
    // Not exercised here.
  }
}

describe('LevelDirector — one formation per pass (GDD v0.8 §4.6, ADR-0019)', () => {
  it('gives every member of a Popcorn group one formation, a new one for each group', () => {
    const script: LevelScript = testScript([
      { at: 0, archetype: POPCORN, count: 5, interval: 0.25, spawn: { x: 80, y: -8 } },
      { at: 3, archetype: POPCORN, count: 5, interval: 0.25, spawn: { x: 80, y: -8 } },
      { at: 0, archetype: GUNNER, count: 1, spawn: { x: -16, y: 80 }, hover: { x: 60, y: 80 } },
    ]);
    const director = new LevelDirector(script);
    const recorder = new FormationRecorder();
    for (let i = 0; i < 2 * 180; i += 1) director.tick(recorder);
    expect(recorder.started).toEqual([5, 5]);
    const popcorn = recorder.members.filter((m) => m !== undefined);
    expect(popcorn).toHaveLength(10);
    expect(new Set(popcorn.slice(0, 5)).size).toBe(1);
    expect(new Set(popcorn).size).toBe(2);
    expect(recorder.members.filter((m) => m === undefined)).toHaveLength(1);
  });
});

describe('World — formations settle (class diagram, ADR-0019)', () => {
  it('settles a formation whose member leaves the field alive', () => {
    const world = new World();
    const formation = world.startFormation(1, true);
    expect(world.formations.count).toBe(1);
    world.spawnEnemy({ at: 0, archetype: POPCORN, count: 1, spawn: { x: 120, y: 100 } }, formation);
    const enemy = world.enemies.at(0);
    enemy.entered = true;
    enemy.position.y = 400;
    world.sweep();
    expect(formation?.destroyed).toBe(0);
    expect(world.formations.count).toBe(0);
  });
});

describe('Run — drops, formation P and collection (GDD v0.8 §4.6, §5.2; ADR-0019)', () => {
  it('seeds level 1 with mixSeed(seed, 0) through createRandom', () => {
    const seeds: number[] = [];
    new Run({
      seed: 42,
      createRandom: (levelSeed) => {
        seeds.push(levelSeed);
        return scripted([]);
      },
    });
    expect(seeds).toEqual([mixSeed(42, 0)]);
    expect(mixSeed(42, 0)).not.toBe(mixSeed(43, 0));
  });

  it.each([
    // GDD v0.11 §5.2: rate 10 %, the colour from r / rate — red below 0.05, blue from 0.05.
    [0.02, PickupKind.PRed],
    [0.07, PickupKind.PBlue],
  ])('drops a Gunner P on a draw of %d below 10 %, its colour from the same draw', (r, kind) => {
    const run = new Run({ createRandom: () => scripted([r]) });
    const log = logOf(run, [SPAWNED]);
    run.rules.destroyEnemy(enemyAt(GUNNER, 60, 80));
    expect(log).toEqual([`${String(SPAWNED)}:${String(kind)}:0@60,80`]);
    expect(run.snapshot().pickups.at(0).kind).toBe(kind);
  });

  it.each([
    // GDD v0.11 §5.2.1: rate 30 %, a Bomb below 0.15, a Shield from 0.15.
    [0.1, PickupKind.Bomb],
    [0.2, PickupKind.Shield],
  ])('drops a Heavy %d below 30 % as a Bomb or a Shield picked by the same draw', (r, kind) => {
    const run = new Run({ createRandom: () => scripted([r]) });
    const log = logOf(run, [SPAWNED]);
    run.rules.destroyEnemy(enemyAt(HEAVY_RING, 60, 80));
    expect(log).toEqual([`${String(SPAWNED)}:${String(kind)}:0@60,80`]);
  });

  it('drops nothing from a Heavy on a draw of 30 % or more', () => {
    const run = new Run({ createRandom: () => scripted([0.3]) });
    run.rules.destroyEnemy(enemyAt(HEAVY_RING, 60, 80));
    expect(run.snapshot().pickups.count).toBe(0);
  });

  it('scores a destroyed Heavy 1 000 points and announces its Large tier', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const log = logOf(run, [GameEventKind.EnemyDestroyed]);
    run.rules.destroyEnemy(enemyAt(HEAVY_RING, 60, 80));
    expect(log).toEqual([
      `${String(GameEventKind.EnemyDestroyed)}:${String(SizeTier.Large)}:1000@60,80`,
    ]);
  });

  it('drops nothing on a draw of 10 % or more, and draws nothing for a Popcorn', () => {
    const draws: number[] = [];
    const random: Random = {
      next: (): number => {
        draws.push(0.1);
        return 0.1;
      },
      seed: (): void => undefined,
    };
    const run = new Run({ createRandom: () => random });
    run.rules.destroyEnemy(enemyAt(GUNNER, 60, 80));
    run.rules.destroyEnemy(enemyAt(POPCORN, 60, 80));
    expect(run.snapshot().pickups.count).toBe(0);
    expect(draws).toHaveLength(1);
  });

  describe('the drop roll boundaries (ADR-0019: a drop when r < rate × dropRateScale)', () => {
    /** A Random that always returns `value` and records each draw. */
    const countingRandom = (value: number): { random: Random; draws: number[] } => {
      const draws: number[] = [];
      const random: Random = {
        next: (): number => {
          draws.push(value);
          return value;
        },
        seed: (): void => undefined,
      };
      return { random, draws };
    };
    const roll = (archetype: EnemyArchetype, draws: readonly number[]): Run => {
      const run = new Run({ createRandom: () => scripted(draws) });
      run.rules.destroyEnemy(enemyAt(archetype, 60, 80));
      return run;
    };
    /** A Gunner with its own drop table. */
    const withDrops = (rate: number, kinds: readonly PickupKind[]): EnemyArchetype => ({
      ...GUNNER,
      drops: { rate, kinds },
    });

    it.each([
      ['a rate of 0 with kinds', withDrops(0, [PickupKind.PRed, PickupKind.PBlue])],
      ['kinds that are empty at a rate of 1', withDrops(1, [])],
    ])('draws nothing and drops nothing for %s', (_label, archetype) => {
      const { random, draws } = countingRandom(0); // 0 would drop on any rule that rolled
      const run = new Run({ createRandom: () => random });
      run.rules.destroyEnemy(enemyAt(archetype, 60, 80));
      expect(draws).toHaveLength(0);
      expect(run.snapshot().pickups.count).toBe(0);
    });

    it.each([
      [0, PickupKind.PRed],
      [0.2499, PickupKind.PRed],
      [0.25, PickupKind.PBlue],
      [0.4999, PickupKind.PBlue],
    ])('drops on a draw of %s below a rate of 0.5, the kind from the same draw', (r, kind) => {
      const run = roll(withDrops(0.5, [PickupKind.PRed, PickupKind.PBlue]), [r]);
      expect(run.snapshot().pickups.count).toBe(1);
      expect(run.snapshot().pickups.at(0).kind).toBe(kind);
    });

    it.each([0.5, 0.5001, 0.99])(
      'drops nothing on a draw of %s, at or above a rate of 0.5',
      (r) => {
        const run = roll(withDrops(0.5, [PickupKind.PRed, PickupKind.PBlue]), [r]);
        expect(run.snapshot().pickups.count).toBe(0);
      },
    );

    it('costs exactly one random draw per kill that can drop, so a seeded replay stays stable', () => {
      const { random, draws } = countingRandom(0.9);
      const run = new Run({ createRandom: () => random });
      run.rules.destroyEnemy(enemyAt(withDrops(0.5, [PickupKind.PRed]), 60, 80));
      expect(draws).toHaveLength(1);
    });
  });

  it('drops a P of the dominant colour where the last member of a full formation dies', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const log = logOf(run, [SPAWNED, CLEARED]);
    const formation = new Formation();
    formation.start(2);
    run.rules.destroyEnemy(enemyAt(POPCORN, 50, 40, formation));
    expect(log).toEqual([]);
    run.rules.destroyEnemy(enemyAt(POPCORN, 70, 90, formation));
    expect(log).toEqual([`${String(CLEARED)}:0:0@70,90`, `${String(SPAWNED)}:0:0@70,90`]);
  });

  it('skips only the P when the formation does not pay: it still publishes FORMATION_CLEARED', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const log = logOf(run, [SPAWNED, CLEARED]);
    const formation = new Formation();
    formation.start(2, false);
    run.rules.destroyEnemy(enemyAt(POPCORN, 50, 40, formation));
    run.rules.destroyEnemy(enemyAt(POPCORN, 70, 90, formation));
    expect(log).toEqual([`${String(CLEARED)}:0:0@70,90`]);
    expect(run.snapshot().pickups.count).toBe(0);
    expect(formation.rewarded).toBe(true);
  });

  it('still pays when paysP is passed as true', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const log = logOf(run, [SPAWNED, CLEARED]);
    const formation = new Formation();
    formation.start(1, true);
    run.rules.destroyEnemy(enemyAt(POPCORN, 70, 90, formation));
    expect(log).toEqual([`${String(CLEARED)}:0:0@70,90`, `${String(SPAWNED)}:0:0@70,90`]);
  });

  it('drops no P for a formation one of whose members escaped', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const formation = new Formation();
    formation.start(2);
    formation.escaped += 1;
    run.rules.destroyEnemy(enemyAt(POPCORN, 70, 90, formation));
    expect(run.snapshot().pickups.count).toBe(0);
  });

  it('publishes no PICKUP_SPAWNED for a drop refused by a full pool', () => {
    const run = new Run({ createRandom: () => scripted(Array.from({ length: 9 }, () => 0.02)) });
    const log = logOf(run, [SPAWNED]);
    for (let i = 0; i < PICKUP_POOL_SIZE + 1; i += 1)
      run.rules.destroyEnemy(enemyAt(GUNNER, 60, 80));
    expect(log).toHaveLength(PICKUP_POOL_SIZE);
  });

  it('announces no death release when the full pool has no room for it', () => {
    const run = new Run({ createRandom: () => scripted(Array.from({ length: 8 }, () => 0.02)) });
    const pickup = new Pickup();
    pickup.spawn(PickupKind.PRed, 100, 200, 1);
    run.rules.pickupCollected(pickup); // power 2, so the death loses a level
    for (let i = 0; i < PICKUP_POOL_SIZE; i += 1) run.rules.destroyEnemy(enemyAt(GUNNER, 60, 80));
    expect(run.snapshot().pickups.count).toBe(PICKUP_POOL_SIZE);
    const log = logOf(run, [SPAWNED]);
    run.rules.playerDied();
    expect(log).toEqual([]);
    expect(run.snapshot().power).toBe(1);
  });

  it('applies a caught P and scores the cap bonus flat, outside the chain', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const log = logOf(run, [COLLECTED]);
    const pickup = new Pickup();
    pickup.spawn(PickupKind.PBlue, 100, 200, 1);
    run.rules.pickupCollected(pickup);
    expect([run.snapshot().weaponKind, run.snapshot().power]).toEqual([WeaponKind.Laser, 2]);
    for (let i = 0; i < 3; i += 1) run.rules.pickupCollected(pickup);
    expect(run.snapshot().score).toBe(0);
    run.rules.pickupCollected(pickup);
    expect(run.snapshot().score).toBe(1000);
    expect(run.snapshot().multiplier).toBe(1);
    expect(run.snapshot().chainRatio).toBe(0);
    expect(log.at(-1)).toBe(`${String(COLLECTED)}:${String(PickupKind.PBlue)}:1000@100,200`);
  });
});

const POPCORN_ROW: ScriptEvent = { at: 0, archetype: POPCORN, count: 1, spawn: { x: 120, y: 100 } };

describe('Formations — refused members never count against the player (GDD v0.8 §5.2.1)', () => {
  /** A run whose enemy pool is full: every further spawn is refused. */
  function fullRun(): Run {
    const run = new Run({ createRandom: () => scripted([]) });
    for (let i = 0; i < ENEMY_POOL_SIZE; i += 1) run.rules.spawnEnemy(POPCORN_ROW, undefined);
    return run;
  }

  it('pays the P once every member that appeared is destroyed, a refused one before', () => {
    const run = fullRun();
    const log = logOf(run, [CLEARED, SPAWNED]);
    const formation = new Formation();
    formation.start(2);
    expect(run.rules.spawnEnemy(POPCORN_ROW, formation)).toBe(false);
    run.rules.destroyEnemy(enemyAt(POPCORN, 70, 90, formation));
    expect(log).toEqual([`${String(CLEARED)}:0:0@70,90`, `${String(SPAWNED)}:0:0@70,90`]);
  });

  it('pays it in the step the last member is refused, after the others were destroyed', () => {
    const run = fullRun();
    const log = logOf(run, [CLEARED, SPAWNED]);
    const formation = new Formation();
    formation.start(2);
    run.rules.destroyEnemy(enemyAt(POPCORN, 50, 60, formation));
    expect(log).toEqual([]);
    run.rules.spawnEnemy(POPCORN_ROW, formation);
    expect(log).toEqual([`${String(CLEARED)}:0:0@50,60`, `${String(SPAWNED)}:0:0@50,60`]);
  });

  it('completes a non-paying formation on a refused last member: cleared, no P', () => {
    const run = fullRun();
    const log = logOf(run, [CLEARED, SPAWNED]);
    const formation = new Formation();
    formation.start(2, false);
    run.rules.destroyEnemy(enemyAt(POPCORN, 50, 60, formation));
    run.rules.spawnEnemy(POPCORN_ROW, formation);
    expect(log).toEqual([`${String(CLEARED)}:0:0@50,60`]);
  });

  it('pays nothing for a formation whose every member was refused', () => {
    const run = fullRun();
    const formation = new Formation();
    formation.start(1);
    run.rules.spawnEnemy(POPCORN_ROW, formation);
    expect(formation.isCleared()).toBe(false);
    expect(run.snapshot().pickups.count).toBe(0);
  });

  it('drops the whole group when the formation pool is full', () => {
    const director = new LevelDirector(
      testScript([
        { at: 0, archetype: POPCORN, count: 5, interval: 0.25, spawn: { x: 80, y: -8 } },
        { at: 0, archetype: GUNNER, count: 1, spawn: { x: -16, y: 80 }, hover: { x: 60, y: 80 } },
      ]),
    );
    const spawned: string[] = [];
    const noFormation: EnemySpawner = {
      startFormation: () => undefined,
      spawnEnemy: (event) => {
        spawned.push(event.archetype.id);
        return true;
      },
      startBoss: () => undefined,
    };
    for (let i = 0; i < 120; i += 1) director.tick(noFormation);
    expect(spawned).toEqual(['gunner']);
  });

  it('never needs more than 16 formations over level 1, nobody shooting', () => {
    const world = new World();
    const spawner: EnemySpawner = {
      startFormation: (total, paysP) => world.startFormation(total, paysP),
      spawnEnemy: (event, formation) => world.spawnEnemy(event, formation),
      startBoss: () => undefined,
    };
    const director = new LevelDirector(LEVEL_1);
    let most = 0;
    for (let i = 0; i < 7200; i += 1) {
      director.tick(spawner);
      world.moveEnemies(DT);
      world.moveBullets(DT);
      world.sweep();
      most = Math.max(most, world.formations.count);
    }
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(FORMATION_POOL_SIZE);
  });
});

describe('Pickups — several in one step, and after Game over (GDD v0.8 §4.6)', () => {
  it('applies two pickups caught in one step in the order of the active list', () => {
    const world = worldAfter(120);
    world.spawnPickup(PickupKind.PRed, 120, 272);
    world.spawnPickup(PickupKind.PBlue, 120, 272);
    const run = new Run({ createRandom: () => scripted([]) });
    const rules = new Collected();
    CollisionResolver.resolve(world, rules);
    expect(rules.kinds).toEqual([PickupKind.PRed, PickupKind.PBlue]);
    for (const kind of rules.kinds) {
      const pickup = new Pickup();
      pickup.spawn(kind, 0, 0, 1);
      run.rules.pickupCollected(pickup);
    }
    expect([run.snapshot().weaponKind, run.snapshot().power]).toEqual([WeaponKind.Laser, 3]);
  });

  it('catches nothing once the last death sequence has ended', () => {
    const world = worldAfter(120);
    for (let life = 0; life < 3; life += 1) {
      world.player.hit();
      for (let i = 0; i < 300 && world.player.state !== PlayerState.Vulnerable; i += 1) {
        world.player.update(createIntentFrame(), DT, world);
        world.player.advanceTimers();
      }
    }
    expect(world.player.isOut).toBe(true);
    world.spawnPickup(PickupKind.PRed, world.player.position.x, world.player.position.y);
    const rules = new Collected();
    CollisionResolver.resolve(world, rules);
    expect(rules.kinds).toEqual([]);
  });
});

describe('mixSeed — the per-level seed (ADR-0019)', () => {
  it('is pinned, so a change of the mix never goes unnoticed', () => {
    expect(mixSeed(1, 0)).toBe(1364076727);
    expect(mixSeed(1, 1)).toBe(920564995);
  });
});

describe('Run — the player bullet pool at Spread level 5 (GDD v0.8 §5.2.1)', () => {
  it('never fills the 80-bullet pool with fire held at level 5', () => {
    const run = new Run({ levels: [testScript()] });
    const red = new Pickup();
    red.spawn(PickupKind.PRed, 0, 0, 1);
    for (let i = 0; i < 4; i += 1) run.rules.pickupCollected(red);
    expect(run.snapshot().power).toBe(5);
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    let most = 0;
    for (let i = 0; i < 600; i += 1) {
      run.step(DT, fire);
      most = Math.max(most, run.snapshot().playerBullets.count);
    }
    expect(most).toBeGreaterThan(50);
    expect(most).toBeLessThan(PLAYER_BULLET_POOL_SIZE);
  });
});
