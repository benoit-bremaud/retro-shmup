import { ActiveList } from './active-list';
import { Bullet } from './bullet';
import { FIELD_HEIGHT, FIELD_WIDTH } from './geometry';
import { Player } from './player';
import { PLAYER_BULLET_POOL_SIZE } from './tuning';
import type { PlayerShotSpawner, ShotSpec } from './weapon';

/**
 * What is on the field during a run (class diagram, view A): the player and the active lists,
 * each over its own pool (class diagram notes, active lists).
 */
export class World implements PlayerShotSpawner {
  readonly player = new Player();
  readonly playerBullets = new ActiveList(PLAYER_BULLET_POOL_SIZE, () => new Bullet());

  /** An empty pool drops the shot: the loop never allocates (ADR-0002). */
  spawnPlayerBullet(x: number, y: number, shot: Readonly<ShotSpec>): void {
    const bullet = this.playerBullets.add();
    if (bullet === undefined) return;
    bullet.position.x = x;
    bullet.position.y = y;
    bullet.previousPosition.x = x;
    bullet.previousPosition.y = y;
    bullet.velocity.x = shot.vxPerSecond;
    bullet.velocity.y = shot.vyPerSecond;
    bullet.width = shot.width;
    bullet.height = shot.height;
    bullet.damage = shot.damage;
    bullet.pierceLeft = shot.pierce;
  }

  /** Step 4 of `Run.step`. */
  moveBullets(dt: number): void {
    for (let i = 0; i < this.playerBullets.count; i += 1) {
      const bullet = this.playerBullets.at(i);
      bullet.previousPosition.x = bullet.position.x;
      bullet.previousPosition.y = bullet.position.y;
      bullet.position.x += bullet.velocity.x * dt;
      bullet.position.y += bullet.velocity.y * dt;
    }
  }

  /** Step 6 of `Run.step`, the single release point: bullets fully outside the field leave. */
  sweep(): void {
    this.playerBullets.sweep(isOutsideField);
  }
}

function isOutsideField(bullet: Bullet): boolean {
  const halfWidth = bullet.width / 2;
  const halfHeight = bullet.height / 2;
  return (
    bullet.position.y + halfHeight <= 0 ||
    bullet.position.y - halfHeight >= FIELD_HEIGHT ||
    bullet.position.x + halfWidth <= 0 ||
    bullet.position.x - halfWidth >= FIELD_WIDTH
  );
}
