import { applyDamage } from './body';
import type { Bullet } from './bullet';
import type { Enemy } from './enemy';
import type { Box } from './geometry';
import type { Pickup } from './pickup';
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
  /** The ship caught the pickup, already marked spent: `Run` applies it and publishes it. */
  pickupCollected(pickup: Pickup): void;
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

// One hit: a bullet with no pass-through left is spent, a bolt passing through remembers the body.
function hitEnemy(bullet: Bullet, enemy: Enemy, rules: HitRules): void {
  if (bullet.pierceLeft === 0) {
    bullet.spent = true;
  } else {
    bullet.recordHit(enemy.serial);
    bullet.pierceLeft -= 1;
  }
  const destroyed = applyDamage(enemy, bullet.damage);
  rules.enemyHit(enemy);
  if (destroyed) rules.destroyEnemy(enemy);
}

// Pass 1: player bullets against enemies. A Spread bullet hits one enemy and is spent; a Laser bolt
// passes through up to three, each body hit once, every one taking the full damage (GDD v0.8 §4.3).
function shotsAgainstEnemies(world: World, rules: HitRules): void {
  for (let i = 0; i < world.playerBullets.count; i += 1) {
    const bullet = world.playerBullets.at(i);
    for (let j = 0; j < world.enemies.count && !bullet.spent; j += 1) {
      const enemy = world.enemies.at(j);
      if (enemy.spent || !overlaps(bullet, enemy) || !bullet.canHit(enemy.serial)) continue;
      hitEnemy(bullet, enemy, rules);
    }
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

// The ship's full sprite box catches pickups, generously (GDD §4.6).
const COLLECT = PlayerTuning.collectSize;

function overlapsSprite(player: Player, box: Box): boolean {
  return (
    Math.abs(player.position.x - box.position.x) < (COLLECT + box.width) / 2 &&
    Math.abs(player.position.y - box.position.y) < (COLLECT + box.height) / 2
  );
}

// Pass 4: pickups against the ship, after the hazards: a ship dying this step catches nothing.
// Several pickups in one step apply in the order of the active list (GDD v0.8 §4.6).
function pickupsAgainstPlayer(world: World, rules: HitRules): void {
  if (!world.player.canCollect) return;
  for (let i = 0; i < world.pickups.count; i += 1) {
    const pickup = world.pickups.at(i);
    if (pickup.spent || !overlapsSprite(world.player, pickup)) continue;
    pickup.spent = true;
    rules.pickupCollected(pickup);
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
    pickupsAgainstPlayer(world, rules);
  },
} as const;
