import type { Vec2 } from './geometry';
import { WeaponKind } from './weapon';

/** Bodies a bolt remembers: it is spent on its fourth hit at most (GDD v0.8 §4.3). */
const HIT_MEMORY = 3;

/**
 * A pooled bullet (class diagram: «pooled»). Positions are the bullet's centre in play-field
 * pixels; the velocity is in pixels per second. A Laser bolt remembers the serials of the bodies
 * it passed through, so it hits each one once even while it overlaps it for several steps.
 */
export class Bullet {
  readonly position: Vec2 = { x: 0, y: 0 };
  readonly previousPosition: Vec2 = { x: 0, y: 0 };
  readonly velocity: Vec2 = { x: 0, y: 0 };
  width = 0;
  height = 0;
  /** In tenths of a level-1 shot (ADR-0019). */
  damage = 0;
  /** Pass-throughs left: a hit with none left spends the bullet. */
  pierceLeft = 0;
  /** The weapon that fired a player bullet (its colour); unused by enemy bullets. */
  weapon: WeaponKind = WeaponKind.Spread;
  private readonly alreadyHit = [0, 0, 0];
  private alreadyHitCount = 0;
  /** Consumed this step: skipped by every pass, released at step 6 (mark, then release). */
  spent = false;

  /** At spawn: no body hit yet. */
  forgetHits(): void {
    this.alreadyHitCount = 0;
  }

  canHit(serial: number): boolean {
    for (let i = 0; i < this.alreadyHitCount; i += 1) {
      if (this.alreadyHit[i] === serial) return false;
    }
    return true;
  }

  /** A pass-through: the body is remembered (at most three, the most a bolt passes through). */
  recordHit(serial: number): void {
    if (this.alreadyHitCount >= HIT_MEMORY) return;
    this.alreadyHit[this.alreadyHitCount] = serial;
    this.alreadyHitCount += 1;
  }
}
