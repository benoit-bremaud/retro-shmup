import { describe, expect, it } from 'vitest';
import { CollisionResolver } from '../../src/domain/game/collision';
import type { HitRules } from '../../src/domain/game/collision';
import { Enemy, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import { Formation } from '../../src/domain/game/formation';
import { LevelDirector } from '../../src/domain/game/level-director';
import type { EnemySpawner } from '../../src/domain/game/level-director';
import type { LevelScript, ScriptEvent } from '../../src/domain/game/level-script';
import { Pickup, PickupKind } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import { Run } from '../../src/domain/game/run';
import { PICKUP_POOL_SIZE } from '../../src/domain/game/tuning';
import { Weapon, WeaponKind } from '../../src/domain/game/weapon';
import { World } from '../../src/domain/game/world';
import { createIntentFrame } from '../../src/domain/ports/input-port';
import type { Random } from '../../src/domain/ports/random';
import { mixSeed } from '../../src/domain/random/seeded-random';

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
    expect(weapon.powerUp(WeaponKind.Spread)).toBe(0);
    expect(weapon.powerUp(WeaponKind.Laser)).toBe(0);
    expect([weapon.kind, weapon.level]).toEqual([WeaponKind.Laser, 3]);
  });

  it('pays 1 000 at level 5, and an other-colour P still switches', () => {
    const weapon = new Weapon();
    for (let i = 0; i < 4; i += 1) weapon.powerUp(WeaponKind.Spread);
    expect(weapon.level).toBe(5);
    expect(weapon.powerUp(WeaponKind.Spread)).toBe(1000);
    expect(weapon.powerUp(WeaponKind.Laser)).toBe(1000);
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
  startFormation(size: number): Formation {
    this.started.push(size);
    const formation = new Formation();
    formation.start(size);
    return formation;
  }
  spawnEnemy(_event: Readonly<ScriptEvent>, formation: Formation | undefined): void {
    this.members.push(formation);
  }
}

describe('LevelDirector — one formation per pass (GDD v0.8 §4.6, ADR-0019)', () => {
  it('gives every member of a Popcorn group one formation, a new one each loop pass', () => {
    const script: LevelScript = {
      loopAt: 3,
      dominantColour: PickupKind.PRed,
      events: [
        { at: 0, archetype: POPCORN, count: 5, interval: 0.25, spawn: { x: 80, y: -8 } },
        { at: 0, archetype: GUNNER, count: 1, spawn: { x: -16, y: 80 }, hover: { x: 60, y: 80 } },
      ],
    };
    const director = new LevelDirector(script);
    const recorder = new FormationRecorder();
    for (let i = 0; i < 2 * 180; i += 1) director.tick(recorder);
    expect(recorder.started).toEqual([5, 5]);
    const popcorn = recorder.members.filter((m) => m !== undefined);
    expect(popcorn).toHaveLength(10);
    expect(new Set(popcorn.slice(0, 5)).size).toBe(1);
    expect(new Set(popcorn).size).toBe(2);
    expect(recorder.members.filter((m) => m === undefined)).toHaveLength(2);
  });
});

describe('World — formations settle (class diagram, ADR-0019)', () => {
  it('settles a formation whose member leaves the field alive', () => {
    const world = new World();
    const formation = world.startFormation(1);
    expect(formation).toBeDefined();
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
    [0.1, PickupKind.PRed],
    [0.2, PickupKind.PBlue],
  ])('drops a Gunner P on a draw of %d below 30 %, its colour from the same draw', (r, kind) => {
    const run = new Run({ createRandom: () => scripted([r]) });
    const log = logOf(run, [SPAWNED]);
    run.destroyEnemy(enemyAt(GUNNER, 60, 80));
    expect(log).toEqual([`${String(SPAWNED)}:${String(kind)}:0@60,80`]);
    expect(run.snapshot().pickups.at(0).kind).toBe(kind);
  });

  it('drops nothing on a draw of 30 % or more, and draws nothing for a Popcorn', () => {
    const draws: number[] = [];
    const random: Random = {
      next: (): number => {
        draws.push(0.3);
        return 0.3;
      },
      seed: (): void => undefined,
    };
    const run = new Run({ createRandom: () => random });
    run.destroyEnemy(enemyAt(GUNNER, 60, 80));
    run.destroyEnemy(enemyAt(POPCORN, 60, 80));
    expect(run.snapshot().pickups.count).toBe(0);
    expect(draws).toHaveLength(1);
  });

  it('drops a P of the dominant colour where the last member of a full formation dies', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const log = logOf(run, [SPAWNED, CLEARED]);
    const formation = new Formation();
    formation.start(2);
    run.destroyEnemy(enemyAt(POPCORN, 50, 40, formation));
    expect(log).toEqual([]);
    run.destroyEnemy(enemyAt(POPCORN, 70, 90, formation));
    expect(log).toEqual([`${String(CLEARED)}:0:0@70,90`, `${String(SPAWNED)}:0:0@70,90`]);
  });

  it('drops no P for a formation one of whose members escaped', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const formation = new Formation();
    formation.start(2);
    formation.memberLost();
    run.destroyEnemy(enemyAt(POPCORN, 70, 90, formation));
    expect(run.snapshot().pickups.count).toBe(0);
  });

  it('publishes no PICKUP_SPAWNED for a drop refused by a full pool', () => {
    const run = new Run({ createRandom: () => scripted(Array.from({ length: 9 }, () => 0.1)) });
    const log = logOf(run, [SPAWNED]);
    for (let i = 0; i < PICKUP_POOL_SIZE + 1; i += 1) run.destroyEnemy(enemyAt(GUNNER, 60, 80));
    expect(log).toHaveLength(PICKUP_POOL_SIZE);
  });

  it('applies a caught P and scores the cap bonus flat, outside the chain', () => {
    const run = new Run({ createRandom: () => scripted([]) });
    const log = logOf(run, [COLLECTED]);
    const pickup = new Pickup();
    pickup.spawn(PickupKind.PBlue, 100, 200, 1);
    run.pickupCollected(pickup);
    expect([run.snapshot().weaponKind, run.snapshot().power]).toEqual([WeaponKind.Laser, 2]);
    for (let i = 0; i < 3; i += 1) run.pickupCollected(pickup);
    expect(run.snapshot().score).toBe(0);
    run.pickupCollected(pickup);
    expect(run.snapshot().score).toBe(1000);
    expect(run.snapshot().multiplier).toBe(1);
    expect(run.snapshot().chainRatio).toBe(0);
    expect(log.at(-1)).toBe(`${String(COLLECTED)}:${String(PickupKind.PBlue)}:1000@100,200`);
  });
});
