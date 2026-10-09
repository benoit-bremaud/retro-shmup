import { FixedPool } from '../pool/fixed-pool';
import { Bullet } from './bullet';
import { FIELD_HEIGHT, FIELD_WIDTH } from './geometry';
import { Player } from './player';
import { PLAYER_BULLET_POOL_SIZE } from './tuning';
import type { BulletSpawner, ShotSpec } from './weapon';

/**
 * What is on the field during a run (class diagram, view A): the player and the pools. Active
 * bullets are references into the pool, kept in a preallocated list (class diagram notes).
 */
export class World implements BulletSpawner {
  readonly player = new Player();
  /** The first `playerBulletCount` entries are the active bullets. */
  readonly playerBullets: Bullet[] = new Array<Bullet>(PLAYER_BULLET_POOL_SIZE);
  private activePlayerBullets = 0;
  private readonly playerBulletPool = new FixedPool(PLAYER_BULLET_POOL_SIZE, () => new Bullet());

  get playerBulletCount(): number {
    return this.activePlayerBullets;
  }

  /** An empty pool drops the shot: the loop never allocates (ADR-0002). */
  spawnPlayerBullet(x: number, y: number, shot: Readonly<ShotSpec>): void {
    const bullet = this.playerBulletPool.acquire();
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
    this.playerBullets[this.activePlayerBullets] = bullet;
    this.activePlayerBullets += 1;
  }

  /** Step 4 of `Run.step`. */
  moveBullets(dt: number): void {
    for (let i = 0; i < this.activePlayerBullets; i += 1) {
      const bullet = this.playerBullets[i];
      if (bullet === undefined) continue;
      bullet.previousPosition.x = bullet.position.x;
      bullet.previousPosition.y = bullet.position.y;
      bullet.position.x += bullet.velocity.x * dt;
      bullet.position.y += bullet.velocity.y * dt;
    }
  }

  /**
   * Step 6 of `Run.step`: bullets fully outside the field go back to the pool. Backwards,
   * swap-with-last, then release — the only place an entry leaves either list (class diagram notes).
   */
  releaseOffscreen(): void {
    for (let i = this.activePlayerBullets - 1; i >= 0; i -= 1) {
      const bullet = this.playerBullets[i];
      if (bullet === undefined || !isOutsideField(bullet)) continue;
      const last = this.activePlayerBullets - 1;
      const lastBullet = this.playerBullets[last];
      if (lastBullet !== undefined) this.playerBullets[i] = lastBullet;
      this.activePlayerBullets = last;
      this.playerBulletPool.release(bullet);
    }
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
