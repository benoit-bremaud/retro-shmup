import { FixedPool } from '../pool/fixed-pool';

/** What readers of an active list see: the active items, by index, never the pool. */
export interface ReadonlyActiveList<T> {
  readonly count: number;
  /** @throws RangeError outside [0, count). */
  at(index: number): Readonly<T>;
}

/**
 * The active items of one kind (class diagram notes, active lists): references into a pool it
 * owns, kept in a preallocated array whose first `count` entries are active. `sweep` is the only
 * place an item leaves the list and the only caller of `release`, so no item is released twice.
 */
export class ActiveList<T extends object> implements ReadonlyActiveList<T> {
  private readonly items: T[];
  private active = 0;
  private readonly pool: FixedPool<T>;

  constructor(capacity: number, create: () => T) {
    this.pool = new FixedPool(capacity, create);
    this.items = new Array<T>(capacity);
  }

  get count(): number {
    return this.active;
  }

  /** Acquires and appends an item; `undefined` when the pool is empty: the request is dropped. */
  add(): T | undefined {
    const item = this.pool.acquire();
    if (item === undefined) return undefined;
    this.items[this.active] = item;
    this.active += 1;
    return item;
  }

  at(index: number): T {
    const item = index >= 0 && index < this.active ? this.items[index] : undefined;
    if (item === undefined) {
      throw new RangeError(
        `ActiveList.at: index ${String(index)} outside [0, ${String(this.active)})`,
      );
    }
    return item;
  }

  /**
   * Releases every item `isDone` accepts: backwards, swap-with-last, then release. Pass a
   * module-level function, never a closure created in the step (no allocation in the loop).
   */
  sweep(isDone: (item: T) => boolean): void {
    for (let i = this.active - 1; i >= 0; i -= 1) {
      const item = this.at(i);
      if (!isDone(item)) continue;
      const last = this.active - 1;
      this.items[i] = this.at(last);
      this.active = last;
      this.pool.release(item);
    }
  }
}
