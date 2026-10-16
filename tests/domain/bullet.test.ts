import { describe, expect, it } from 'vitest';
import { Bullet } from '../../src/domain/game/bullet';

describe('Bullet — pass-through memory (GDD v0.8 §4.3)', () => {
  it('can hit a body it has not passed through', () => {
    expect(new Bullet().canHit(7)).toBe(true);
  });

  it('refuses a body it already passed through, until forgetHits', () => {
    const bullet = new Bullet();
    bullet.recordHit(7);
    expect(bullet.canHit(7)).toBe(false);
    bullet.forgetHits();
    expect(bullet.canHit(7)).toBe(true);
  });

  it('remembers at most three bodies: a fourth record is ignored', () => {
    const bullet = new Bullet();
    bullet.recordHit(1);
    bullet.recordHit(2);
    bullet.recordHit(3);
    bullet.recordHit(4);
    expect([1, 2, 3].map((serial) => bullet.canHit(serial))).toEqual([false, false, false]);
    expect(bullet.canHit(4)).toBe(true);
  });
});
