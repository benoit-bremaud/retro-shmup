import { ActiveList } from './active-list';
import type { EnemyShotSpawner } from './attacks';
import { Boss } from './boss';
import { Bullet } from './bullet';
import { Enemy } from './enemy';
import { Formation } from './formation';
import { FIELD_HEIGHT, overlapsField } from './geometry';
import type { Box } from './geometry';
import type { ScriptEvent } from './level-script';
import type { WorldView } from './movements';
import { Pickup, PickupMotion } from './pickup';
import type { PickupKind } from './pickup';
import { Player } from './player';
import {
  ENEMY_BULLET_POOL_SIZE,
  ENEMY_POOL_SIZE,
  EnemyBulletTuning,
  FORMATION_POOL_SIZE,
  PICKUP_POOL_SIZE,
  PickupTuning,
  PLAYER_BULLET_POOL_SIZE,
  STEP_SECONDS,
} from './tuning';
import type { PlayerShotSpawner, ShotSpec } from './weapon';

/**
 * What is on the field during a run (class diagram, view A): the player and the active lists,
 * each over its own pool (class diagram notes, active lists). It is the spawner of every list and
 * the strategies' view of the world.
 */
export class World implements PlayerShotSpawner, EnemyShotSpawner, WorldView {
  readonly player = new Player();
  readonly playerBullets = new ActiveList(PLAYER_BULLET_POOL_SIZE, () => new Bullet());
  readonly enemyBullets = new ActiveList(ENEMY_BULLET_POOL_SIZE, () => new Bullet());
  readonly enemies = new ActiveList(ENEMY_POOL_SIZE, () => new Enemy());
  readonly pickups = new ActiveList(PICKUP_POOL_SIZE, () => new Pickup());
  readonly formations = new ActiveList(FORMATION_POOL_SIZE, () => new Formation());
  /** The level's one boss, preallocated and idle, outside the enemy pool (ADR-0022). */
  readonly boss = new Boss();
  /** Run-scoped, only increases, never reused: a recycled body is never its predecessor. */
  private nextSerial = 1;

  /** The next serial of the run: enemies, pickups and the boss draw from one counter. */
  takeSerial(): number {
    const serial = this.nextSerial;
    this.nextSerial += 1;
    return serial;
  }

  playerPosition(): Readonly<{ x: number; y: number }> {
    return this.player.position;
  }

  /** An empty pool drops the shot: the loop never allocates (ADR-0002). */
  spawnPlayerBullet(x: number, y: number, shot: Readonly<ShotSpec>): void {
    const bullet = this.playerBullets.add();
    if (bullet === undefined) return;
    placeBullet(bullet, x, y, shot.vxPerSecond, shot.vyPerSecond);
    bullet.width = shot.width;
    bullet.height = shot.height;
    bullet.damage = shot.damage;
    bullet.pierceLeft = shot.pierce;
    bullet.weapon = shot.weapon;
    bullet.forgetHits();
  }

  spawnEnemyBullet(x: number, y: number, vxPerSecond: number, vyPerSecond: number): void {
    const bullet = this.enemyBullets.add();
    if (bullet === undefined) return;
    placeBullet(bullet, x, y, vxPerSecond, vyPerSecond);
    bullet.width = EnemyBulletTuning.size;
    bullet.height = EnemyBulletTuning.size;
    // An enemy bullet takes a life, not HP: its damage is never read (GDD §4.4).
    bullet.damage = 0;
    bullet.pierceLeft = 0;
    bullet.forgetHits();
  }

  /**
   * Step 1, from the level director. An enemy refused by a full pool never exists and takes no
   * serial (GDD v0.6 §5.2.1). Its movement places it at age 0, so it never smears.
   */
  spawnEnemy(event: Readonly<ScriptEvent>, formation: Formation | undefined): boolean {
    const enemy = this.enemies.add();
    if (enemy === undefined) return false;
    enemy.spawn(event.archetype, event, this.takeSerial(), formation);
    event.archetype.movement.tick(enemy, this, 0);
    enemy.previousPosition.x = enemy.position.x;
    enemy.previousPosition.y = enemy.position.y;
    return true;
  }

  /**
   * A formation pass of `total` members; `undefined` on a full pool, and the director then drops
   * the whole group, so no visible group ever lacks its reward (class diagram).
   */
  startFormation(total: number): Formation | undefined {
    const formation = this.formations.add();
    formation?.start(total);
    return formation;
  }

  /**
   * A pickup at (x, y) with `motion`: a falling drop by default, or the death release's hop. False
   * when the pool is full and the spawn is dropped (ADR-0019), so the caller publishes
   * `PICKUP_SPAWNED` only for a pickup that exists.
   */
  spawnPickup(
    kind: PickupKind,
    x: number,
    y: number,
    motion: PickupMotion = PickupMotion.Fall,
  ): boolean {
    const pickup = this.pickups.add();
    if (pickup === undefined) return false;
    pickup.spawn(kind, x, y, this.takeSerial(), motion);
    return true;
  }

  /**
   * Step 4: pickups move as a closed form of their age (GDD v0.8 §4.4, §4.6): a drop falls and
   * sways; the death release rises linearly to `riseTo`, then falls slowly, with no sway.
   */
  movePickups(): void {
    for (let i = 0; i < this.pickups.count; i += 1) {
      const pickup = this.pickups.at(i);
      if (pickup.spent) continue;
      pickup.previousPosition.x = pickup.position.x;
      pickup.previousPosition.y = pickup.position.y;
      pickup.age += 1;
      const seconds = pickup.age * STEP_SECONDS;
      if (pickup.motion === PickupMotion.Release) {
        pickup.position.x = pickup.origin.x;
        pickup.position.y = releaseY(pickup, seconds);
        continue;
      }
      pickup.position.x =
        pickup.origin.x + PickupTuning.swayAmplitude * Math.sin(SWAY_RADIANS_PER_SECOND * seconds);
      pickup.position.y = pickup.origin.y + PickupTuning.fallSpeed * seconds;
    }
  }

  /** The bomb (step slot 3): every enemy bullet is cancelled, released at step 6. */
  cancelEnemyBullets(): void {
    for (let i = 0; i < this.enemyBullets.count; i += 1) this.enemyBullets.at(i).spent = true;
  }

  /** Whether an enemy's box overlaps the field: the bomb's reach (GDD v0.8 §4.5). */
  isOnField(enemy: Enemy): boolean {
    return boxOverlapsField(enemy);
  }

  /**
   * Step 4: enemies age, move and attack, then the boss does; a spawned enemy bullet moves with the
   * others.
   */
  moveEnemies(dt: number): void {
    for (let i = 0; i < this.enemies.count; i += 1) {
      const enemy = this.enemies.at(i);
      if (enemy.spent) continue;
      enemy.previousPosition.x = enemy.position.x;
      enemy.previousPosition.y = enemy.position.y;
      enemy.age += 1;
      enemy.archetype.movement.tick(enemy, this, dt);
      if (!enemy.entered && boxOverlapsField(enemy)) enemy.entered = true;
      enemy.archetype.attack.tick(enemy, this, this, dt);
    }
    this.boss.move(this, dt);
  }

  /** Step 4: every bullet moves by its velocity. */
  moveBullets(dt: number): void {
    moveAll(this.playerBullets, dt);
    moveAll(this.enemyBullets, dt);
  }

  /**
   * Marks every player bullet spent: released at the next sweep (Game over, GDD v0.6 §4.4). Today
   * no shot outlives the 1.5 s death sequence; this keeps the score frozen if slower shots come.
   */
  spendPlayerBullets(): void {
    for (let i = 0; i < this.playerBullets.count; i += 1) this.playerBullets.at(i).spent = true;
  }

  /**
   * Step 6, the single release point: each list releases its spent or departed items. A pre-pass
   * settles the formation of each member leaving alive, so the predicates stay pure (ADR-0019).
   */
  sweep(): void {
    for (let i = 0; i < this.enemies.count; i += 1) {
      const enemy = this.enemies.at(i);
      if (!enemy.spent && isEnemyDone(enemy) && enemy.formation !== undefined) {
        enemy.formation.escaped += 1;
      }
    }
    this.playerBullets.sweep(isBulletDone);
    this.enemyBullets.sweep(isBulletDone);
    this.enemies.sweep(isEnemyDone);
    this.pickups.sweep(isPickupDone);
    this.formations.sweep(isFormationDone);
  }
}

const SWAY_RADIANS_PER_SECOND = (2 * Math.PI) / PickupTuning.swayPeriodSeconds;

// The release hop: a linear rise over 0.8 s, then a fall at 20 px/s.
function releaseY(pickup: Pickup, seconds: number): number {
  const rise = PickupTuning.releaseRiseSeconds;
  if (seconds <= rise) {
    return pickup.origin.y + ((pickup.riseTo - pickup.origin.y) * seconds) / rise;
  }
  return pickup.riseTo + PickupTuning.releaseFallSpeed * (seconds - rise);
}

function placeBullet(bullet: Bullet, x: number, y: number, vx: number, vy: number): void {
  bullet.position.x = x;
  bullet.position.y = y;
  bullet.previousPosition.x = x;
  bullet.previousPosition.y = y;
  bullet.velocity.x = vx;
  bullet.velocity.y = vy;
  bullet.spent = false;
}

function moveAll(bullets: ActiveList<Bullet>, dt: number): void {
  for (let i = 0; i < bullets.count; i += 1) {
    const bullet = bullets.at(i);
    if (bullet.spent) continue;
    bullet.previousPosition.x = bullet.position.x;
    bullet.previousPosition.y = bullet.position.y;
    bullet.position.x += bullet.velocity.x * dt;
    bullet.position.y += bullet.velocity.y * dt;
  }
}

function boxOverlapsField(box: Box): boolean {
  return overlapsField(box.position.x, box.position.y, box.width, box.height);
}

function isOutsideField(box: Box): boolean {
  return !boxOverlapsField(box);
}

function isBulletDone(bullet: Bullet): boolean {
  return bullet.spent || isOutsideField(bullet);
}

// A pickup is lost once its top edge is below the field (GDD §4.6).
function isPickupDone(pickup: Pickup): boolean {
  return pickup.spent || pickup.position.y - pickup.height / 2 >= FIELD_HEIGHT;
}

function isFormationDone(formation: Formation): boolean {
  return formation.isResolved();
}

// An enemy spawns outside the field: it leaves only once it has been inside (GDD v0.6 §5.2.1).
function isEnemyDone(enemy: Enemy): boolean {
  return enemy.spent || (enemy.entered && isOutsideField(enemy));
}
