import { applyDamage } from './body';
import type { Bullet } from './bullet';
import type { Enemy } from './enemy';
import { HitOutcome } from './player';
import type { Player } from './player';
import { PlayerTuning } from './tuning';
import type { World } from './world';

/**
 * What the collision pass asks of the run (class diagram, `HitRules`): declared here and realized
 * by `Run`, so the resolver never imports the run and never sees the bus. `shieldBroken` and
 * `damageBoss` join with their bricks.
 */
export interface HitRules {
  enemyHit(enemy: Enemy): void;
  destroyEnemy(enemy: Enemy): void;
  playerDied(): void;
}

interface Box {
  readonly position: { readonly x: number; readonly y: number };
  readonly width: number;
  readonly height: number;
}

function overlaps(a: Box, b: Box): boolean {
  return (
    Math.abs(a.position.x - b.position.x) < (a.width + b.width) / 2 &&
    Math.abs(a.position.y - b.position.y) < (a.height + b.height) / 2
  );
}

// The ship's 4 × 4 hitbox (GDD §4.1): only it counts, never the sprite.
const HITBOX = PlayerTuning.hitboxSize;

function overlapsHitbox(player: Player, box: Box): boolean {
  return (
    Math.abs(player.position.x - box.position.x) < (HITBOX + box.width) / 2 &&
    Math.abs(player.position.y - box.position.y) < (HITBOX + box.height) / 2
  );
}

function firstEnemyHitBy(world: World, bullet: Bullet): Enemy | undefined {
  for (let i = 0; i < world.enemies.count; i += 1) {
    const enemy = world.enemies.at(i);
    if (!enemy.spent && overlaps(bullet, enemy)) return enemy;
  }
  return undefined;
}

// Pass 1: player bullets against enemies; a bullet hits one enemy and is consumed.
function shotsAgainstEnemies(world: World, rules: HitRules): void {
  for (let i = 0; i < world.playerBullets.count; i += 1) {
    const bullet = world.playerBullets.at(i);
    if (bullet.spent) continue;
    const enemy = firstEnemyHitBy(world, bullet);
    if (enemy === undefined) continue;
    bullet.spent = true;
    rules.enemyHit(enemy);
    if (applyDamage(enemy, bullet.damage)) rules.destroyEnemy(enemy);
  }
}

// Pass 2: enemy bullets against the hitbox; an ignored hit passes through, not consumed.
function bulletsAgainstPlayer(world: World, rules: HitRules): void {
  for (let i = 0; i < world.enemyBullets.count; i += 1) {
    const bullet = world.enemyBullets.at(i);
    if (bullet.spent || !overlapsHitbox(world.player, bullet)) continue;
    if (world.player.hit() !== HitOutcome.Died) continue;
    bullet.spent = true;
    rules.playerDied();
  }
}

// Pass 3: enemy bodies against the hitbox; contact hurts the player, never the enemy (GDD §5.2).
function bodiesAgainstPlayer(world: World, rules: HitRules): void {
  for (let i = 0; i < world.enemies.count; i += 1) {
    const enemy = world.enemies.at(i);
    if (enemy.spent || !overlapsHitbox(world.player, enemy)) continue;
    if (world.player.hit() === HitOutcome.Died) rules.playerDied();
  }
}

/**
 * Step 5 of `Run.step` (class diagram, `CollisionResolver`): marks only — spent bullets and
 * destroyed enemies are released at step 6, so no pool sees a double release.
 */
export const CollisionResolver = {
  resolve(world: World, rules: HitRules): void {
    shotsAgainstEnemies(world, rules);
    bulletsAgainstPlayer(world, rules);
    bodiesAgainstPlayer(world, rules);
  },
} as const;
