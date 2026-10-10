import { ActiveList } from './active-list';
import type { EnemyShotSpawner } from './attacks';
import { Bullet } from './bullet';
import { Enemy } from './enemy';
import { FIELD_HEIGHT, FIELD_WIDTH } from './geometry';
import type { Box } from './geometry';
import type { EnemySpawner } from './level-director';
import type { ScriptEvent } from './level-script';
import type { WorldView } from './movements';
import { Player } from './player';
import {
  ENEMY_BULLET_POOL_SIZE,
  ENEMY_POOL_SIZE,
  EnemyBulletTuning,
  PLAYER_BULLET_POOL_SIZE,
} from './tuning';
import type { PlayerShotSpawner, ShotSpec } from './weapon';

/**
 * What is on the field during a run (class diagram, view A): the player and the active lists,
 * each over its own pool (class diagram notes, active lists). It is the spawner of every list and
 * the strategies' view of the world.
 */
export class World implements PlayerShotSpawner, EnemyShotSpawner, EnemySpawner, WorldView {
  readonly player = new Player();
  readonly playerBullets = new ActiveList(PLAYER_BULLET_POOL_SIZE, () => new Bullet());
  readonly enemyBullets = new ActiveList(ENEMY_BULLET_POOL_SIZE, () => new Bullet());
  readonly enemies = new ActiveList(ENEMY_POOL_SIZE, () => new Enemy());
  /** Run-scoped, only increases, never reused: a recycled enemy is never its predecessor. */
  private nextSerial = 1;

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
  }

  spawnEnemyBullet(x: number, y: number, vxPerSecond: number, vyPerSecond: number): void {
    const bullet = this.enemyBullets.add();
    if (bullet === undefined) return;
    placeBullet(bullet, x, y, vxPerSecond, vyPerSecond);
    bullet.width = EnemyBulletTuning.size;
    bullet.height = EnemyBulletTuning.size;
    bullet.damage = EnemyBulletTuning.damage;
    bullet.pierceLeft = 0;
  }

  /**
   * Step 1, from the level director. An enemy refused by a full pool never exists and takes no
   * serial (GDD v0.6 §5.2.1). Its movement places it at age 0, so it never smears.
   */
  spawnEnemy(event: Readonly<ScriptEvent>): void {
    const enemy = this.enemies.add();
    if (enemy === undefined) return;
    enemy.spawn(event.archetype, event, this.nextSerial);
    this.nextSerial += 1;
    event.archetype.movement.tick(enemy, this, 0);
    enemy.previousPosition.x = enemy.position.x;
    enemy.previousPosition.y = enemy.position.y;
  }

  /** Step 4: enemies age, move and attack; a spawned enemy bullet moves with the others. */
  moveEnemies(dt: number): void {
    for (let i = 0; i < this.enemies.count; i += 1) {
      const enemy = this.enemies.at(i);
      if (enemy.spent) continue;
      enemy.previousPosition.x = enemy.position.x;
      enemy.previousPosition.y = enemy.position.y;
      enemy.age += 1;
      enemy.archetype.movement.tick(enemy, this, dt);
      if (!enemy.entered && overlapsField(enemy)) enemy.entered = true;
      enemy.archetype.attack.tick(enemy, this, this, dt);
    }
  }

  /** Step 4: every bullet moves by its velocity. */
  moveBullets(dt: number): void {
    moveAll(this.playerBullets, dt);
    moveAll(this.enemyBullets, dt);
  }

  /** Marks every player bullet spent: released at the next sweep (Game over, GDD v0.6 §4.4). */
  spendPlayerBullets(): void {
    for (let i = 0; i < this.playerBullets.count; i += 1) this.playerBullets.at(i).spent = true;
  }

  /** Step 6, the single release point: each list releases its spent or departed items. */
  sweep(): void {
    this.playerBullets.sweep(isBulletDone);
    this.enemyBullets.sweep(isBulletDone);
    this.enemies.sweep(isEnemyDone);
  }
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

function isOutsideField(box: Box): boolean {
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  return (
    box.position.y + halfHeight <= 0 ||
    box.position.y - halfHeight >= FIELD_HEIGHT ||
    box.position.x + halfWidth <= 0 ||
    box.position.x - halfWidth >= FIELD_WIDTH
  );
}

function overlapsField(box: Box): boolean {
  return !isOutsideField(box);
}

function isBulletDone(bullet: Bullet): boolean {
  return bullet.spent || isOutsideField(bullet);
}

// An enemy spawns outside the field: it leaves only once it has been inside (GDD v0.6 §5.2.1).
function isEnemyDone(enemy: Enemy): boolean {
  return enemy.spent || (enemy.entered && isOutsideField(enemy));
}
