import type { HitRules } from '../../src/domain/game/collision';
import type { Enemy, EnemyArchetype } from '../../src/domain/game/enemy';
import type { Pickup } from '../../src/domain/game/pickup';
import { PlayerTuning, toSteps } from '../../src/domain/game/tuning';
import { World } from '../../src/domain/game/world';
import { createIntentFrame } from '../../src/domain/ports/input-port';

const DT = 1 / 60;

/** The run's side of the collisions, recorded; marks a destroyed enemy like `Run` does. */
export class Rules implements HitRules {
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

/** Steps from a fresh ship to its first vulnerable step: the fly-in, then the invulnerability. */
export const STEPS_TO_VULNERABLE = toSteps(
  PlayerTuning.flyInSeconds + PlayerTuning.invulnerableSeconds,
);

/** A world whose ship has run `steps` idle steps from its spawn: vulnerable at rest by default. */
export function vulnerableWorld(steps = STEPS_TO_VULNERABLE): World {
  const world = new World();
  const idle = createIntentFrame();
  for (let i = 0; i < steps; i += 1) {
    world.player.update(idle, DT, world);
    world.player.advanceTimers();
  }
  return world;
}

/** An enemy of `archetype` placed at (x, y), whatever its movement did at spawn. */
export function enemyAt(world: World, archetype: EnemyArchetype, x: number, y: number): Enemy {
  world.spawnEnemy({ at: 0, archetype, count: 1, spawn: { x, y } }, undefined);
  const enemy = world.enemies.at(world.enemies.count - 1);
  enemy.position.x = x;
  enemy.position.y = y;
  return enemy;
}
