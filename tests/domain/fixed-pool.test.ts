import { describe, expect, it } from 'vitest';
import { FixedPool } from '../../src/domain/pool/fixed-pool';

interface Bullet {
  x: number;
}

function makePool(capacity: number): { pool: FixedPool<Bullet>; created: () => number } {
  let created = 0;
  const pool = new FixedPool<Bullet>(capacity, () => {
    created += 1;
    return { x: 0 };
  });
  return { pool, created: () => created };
}

describe('FixedPool', () => {
  it('creates every item up front and never afterwards', () => {
    const { pool, created } = makePool(4);
    expect(created()).toBe(4);
    for (let i = 0; i < 10; i += 1) {
      const item = pool.acquire();
      if (item !== undefined) pool.release(item);
    }
    expect(created()).toBe(4);
  });

  it('exposes its capacity as size', () => {
    expect(makePool(3).pool.size).toBe(3);
  });

  it('returns undefined when exhausted instead of allocating', () => {
    const { pool } = makePool(2);
    expect(pool.acquire()).toBeDefined();
    expect(pool.acquire()).toBeDefined();
    expect(pool.acquire()).toBeUndefined();
  });

  it('hands out distinct items and reuses released ones', () => {
    const { pool } = makePool(2);
    const a = pool.acquire();
    const b = pool.acquire();
    expect(a).not.toBe(b);
    if (a === undefined) throw new Error('expected an item');
    pool.release(a);
    expect(pool.acquire()).toBe(a);
  });

  it('rejects a double release, which would corrupt the free list', () => {
    const { pool } = makePool(1);
    const item = pool.acquire();
    if (item === undefined) throw new Error('expected an item');
    pool.release(item);
    expect(() => {
      pool.release(item);
    }).toThrow(/not in use/);
  });

  it('rejects an item that does not belong to the pool', () => {
    const { pool } = makePool(1);
    expect(() => {
      pool.release({ x: 1 });
    }).toThrow(/not in use/);
  });

  it('rejects a factory that returns the same object twice', () => {
    const shared = { x: 0 };
    expect(() => new FixedPool<Bullet>(2, () => shared)).toThrow(/same object/);
  });

  it('rejects a capacity that is not a positive integer', () => {
    expect(() => new FixedPool<Bullet>(0, () => ({ x: 0 }))).toThrow(/capacity/);
    expect(() => new FixedPool<Bullet>(1.5, () => ({ x: 0 }))).toThrow(/capacity/);
  });
});
