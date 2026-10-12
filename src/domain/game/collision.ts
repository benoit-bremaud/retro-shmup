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
  /** The shield charge absorbed a hit (GDD v0.8 §4.4). */
  shieldBroken(): void;
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

// One hit, in the order of the kill sequence: the damage, then a bullet with no pass-through
// left is spent while a bolt passing through remembers the body, then the reports.
function hitEnemy(bullet: Bullet, enemy: Enemy, rules: HitRules): void {
  const destroyed = applyDamage(enemy, bullet.damage);
  if (bullet.pierceLeft === 0) {
    bullet.spent = true;
  } else {
    bullet.recordHit(enemy.serial);
    bullet.pierceLeft -= 1;
  }
  rules.enemyHit(enemy);
  if (destroyed) rules.destroyEnemy(enemy);
}

/**
 * The next enemy the bullet meets along its path: of the live enemies it overlaps and has not
 * hit, the one nearest along its velocity (smallest position · velocity), so a bolt crossing a
 * stack hits the closest first, whatever the active list's order. `undefined` when none is left.
 */
function nearestTarget(world: World, bullet: Bullet): Enemy | undefined {
  let nearest: Enemy | undefined;
  let nearestTravel = Number.POSITIVE_INFINITY;
  for (let j = 0; j < world.enemies.count; j += 1) {
    const enemy = world.enemies.at(j);
    if (enemy.spent || !overlaps(bullet, enemy) || !bullet.canHit(enemy.serial)) continue;
    const travel = enemy.position.x * bullet.velocity.x + enemy.position.y * bullet.velocity.y;
    if (travel < nearestTravel) {
      nearest = enemy;
      nearestTravel = travel;
    }
  }
  return nearest;
}

// Pass 1: player bullets against enemies. A Spread bullet hits one enemy and is spent; a Laser bolt
// passes through up to three, nearest first along its path, each body hit once, every one taking
// the full damage (GDD v0.8 §4.3). Each hit spends the bullet, destroys the enemy or records it,
// so the loop ends.
function shotsAgainstEnemies(world: World, rules: HitRules): void {
  for (let i = 0; i < world.playerBullets.count; i += 1) {
    const bullet = world.playerBullets.at(i);
    while (!bullet.spent) {
      const enemy = nearestTarget(world, bullet);
      if (enemy === undefined) break;
      hitEnemy(bullet, enemy, rules);
    }
  }
}

// Reports a hit that counted: a death, or the shield taking it.
function report(outcome: HitOutcome, rules: HitRules): void {
  if (outcome === HitOutcome.Died) rules.playerDied();
  else if (outcome === HitOutcome.Absorbed) rules.shieldBroken();
}

// Pass 2: enemy bullets against the hitbox. A bullet that killed the ship or broke its shield is
// consumed; an ignored hit passes through.
function bulletsAgainstPlayer(world: World, rules: HitRules): void {
  for (let i = 0; i < world.enemyBullets.count; i += 1) {
    const bullet = world.enemyBullets.at(i);
    if (bullet.spent || !overlapsHitbox(world.player, bullet)) continue;
    const outcome = world.player.hit();
    if (outcome === HitOutcome.Ignored) continue;
    bullet.spent = true;
    report(outcome, rules);
  }
}

// Pass 3: enemy bodies against the hitbox; contact hurts the player, never the enemy (GDD §5.2),
// and a body the shield absorbed survives.
function bodiesAgainstPlayer(world: World, rules: HitRules): void {
  for (let i = 0; i < world.enemies.count; i += 1) {
    const enemy = world.enemies.at(i);
    if (enemy.spent || !overlapsHitbox(world.player, enemy)) continue;
    report(world.player.hit(), rules);
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
