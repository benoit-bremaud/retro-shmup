import { describe, expect, it } from 'vitest';
import { CollisionResolver } from '../../src/domain/game/collision';
import { createGameEvent, EventBus, GameEventKind } from '../../src/domain/game/events';
import { PickupKind } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import { ScoreKeeper } from '../../src/domain/game/score-keeper';
import { ScoreTuning } from '../../src/domain/game/tuning';
import type { World } from '../../src/domain/game/world';
import { Rules, STEPS_TO_VULNERABLE, vulnerableWorld } from '../support/collision';

// The ship rests at (120, 272); an enemy bullet is 4 × 4. The graze box is the drawn 32 × 24 ship
// (GDD v0.31 §4.1): a bullet centred 12 px to the side is in a wing, outside the 6 × 6 hitbox.
const SHIP_X = 120;
const SHIP_Y = 272;
const WING_X = SHIP_X + 12;

function resolve(world: World): Rules {
  const rules = new Rules();
  CollisionResolver.resolve(world, rules);
  return rules;
}

describe('CollisionResolver — the graze (GDD v0.31 §4.1, #146)', () => {
  it('grazes a bullet crossing a wing once, and leaves it live', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(WING_X, SHIP_Y, 0, 85);

    const first = resolve(world);
    const second = resolve(world);

    const bullet = world.enemyBullets.at(0);
    expect(first.grazed).toBe(1);
    expect(second.grazed).toBe(0);
    expect(bullet.grazed).toBe(true);
    expect(bullet.spent).toBe(false);
    expect(world.player.state).toBe(PlayerState.Vulnerable);
  });

  it('hits, without a graze, a bullet on the hitbox', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(SHIP_X, SHIP_Y, 0, 85);

    const rules = resolve(world);

    expect(rules.grazed).toBe(0);
    expect(rules.deaths).toBe(1);
  });

  it('still kills with a bullet that grazed earlier', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(WING_X, SHIP_Y, 0, 85);
    resolve(world);
    world.enemyBullets.at(0).position.x = SHIP_X;

    const rules = resolve(world);

    expect(rules.deaths).toBe(1);
  });

  it.each([
    ['just outside the box sideways', SHIP_X + 18, SHIP_Y],
    ['just outside the box vertically', SHIP_X, SHIP_Y + 14],
  ])('does not graze a bullet %s', (_label, x, y) => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(x, y, 0, 85);

    expect(resolve(world).grazed).toBe(0);
  });

  it('grazes at the edge of the box, inside by less than a pixel', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(SHIP_X + 17.5, SHIP_Y - 13.5, 0, 85);

    expect(resolve(world).grazed).toBe(1);
  });

  it.each([
    ['entering', 0, PlayerState.Entering],
    ['invulnerable', STEPS_TO_VULNERABLE - 1, PlayerState.Invulnerable],
  ])('does not graze while the ship is %s', (_label, steps, state) => {
    const world = vulnerableWorld(steps);
    world.spawnEnemyBullet(world.player.position.x + 12, world.player.position.y, 0, 85);

    expect(world.player.state).toBe(state);
    expect(resolve(world).grazed).toBe(0);
    expect(world.enemyBullets.at(0).grazed).toBe(false);
  });

  it('does not graze while a shield charge is held: the ring takes the bullet', () => {
    const world = vulnerableWorld();
    world.player.collect(PickupKind.Shield);
    world.spawnEnemyBullet(WING_X, SHIP_Y, 0, 85);

    const rules = resolve(world);

    expect(rules.grazed).toBe(0);
    expect(rules.absorbed).toBe(1);
  });

  it('lets a reacquired pool bullet graze again', () => {
    const world = vulnerableWorld();
    world.spawnEnemyBullet(WING_X, SHIP_Y, 0, 85);
    resolve(world);
    world.enemyBullets.at(0).spent = true;
    world.sweep();
    world.spawnEnemyBullet(WING_X, SHIP_Y, 0, 85);

    expect(world.enemyBullets.at(0).grazed).toBe(false);
    expect(resolve(world).grazed).toBe(1);
  });
});

describe('ScoreKeeper — the graze (GDD v0.31 §8)', () => {
  it('adds the graze value flat, leaving the chain unchanged', () => {
    const bus = new EventBus();
    const keeper = new ScoreKeeper(bus);
    const grazed = createGameEvent(GameEventKind.BulletGrazed);
    grazed.value = ScoreTuning.graze;

    bus.publish(grazed);

    expect(keeper.score).toBe(100);
    expect(keeper.multiplier).toBe(1);
    expect(keeper.chainRatio).toBe(0);
  });
});
