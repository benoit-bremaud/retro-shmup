/** Object pool contract (ADR-0002): the loop only acquires and releases, never allocates. */
export interface Pool<T> {
  /** `undefined` when every item is in use: the caller drops the request. */
  acquire(): T | undefined;
  release(item: T): void;
  /** Capacity of the pool. */
  readonly size: number;
}

/**
 * Pool filled once at construction (ADR-0002). Releasing an item that is not in use — a double
 * release or a foreign object — throws: it would corrupt the free list silently (fail closed).
 */
export class FixedPool<T extends object> implements Pool<T> {
  readonly size: number;
  private readonly free: T[];
  private freeCount: number;
  private readonly inUse = new Map<T, boolean>();

  constructor(capacity: number, create: () => T) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`Pool capacity must be a positive integer, got ${String(capacity)}`);
    }
    this.size = capacity;
    this.free = [];
    for (let i = 0; i < capacity; i += 1) {
      const item = create();
      this.free.push(item);
      this.inUse.set(item, false);
    }
    this.freeCount = capacity;
  }

  acquire(): T | undefined {
    if (this.freeCount === 0) return undefined;
    this.freeCount -= 1;
    const item = this.free[this.freeCount];
    if (item === undefined) return undefined;
    this.inUse.set(item, true);
    return item;
  }

  release(item: T): void {
    if (this.inUse.get(item) !== true) {
      throw new Error('Pool.release: item is not in use (double release or foreign object)');
    }
    this.inUse.set(item, false);
    this.free[this.freeCount] = item;
    this.freeCount += 1;
  }
}
