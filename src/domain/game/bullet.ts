import type { Vec2 } from './geometry';

/**
 * A pooled bullet (class diagram: «pooled»). Positions are the bullet's centre in play-field
 * pixels; the velocity is in pixels per second. The Laser's hit memory arrives with the Laser.
 */
export class Bullet {
  readonly position: Vec2 = { x: 0, y: 0 };
  readonly previousPosition: Vec2 = { x: 0, y: 0 };
  readonly velocity: Vec2 = { x: 0, y: 0 };
  width = 0;
  height = 0;
  damage = 0;
  pierceLeft = 0;
}
