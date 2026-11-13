import { describe, expect, it } from 'vitest';
import { LocalStorageStore } from '../../src/adapters/local-storage-store';
import type { StorageLike } from '../../src/adapters/local-storage-store';

/** A Web Storage stand-in; `fails` makes every call throw, as a blocked or full storage does. */
function storage(fails = false): StorageLike & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem(key: string): string | null {
      if (fails) throw new Error('SecurityError');
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (fails) throw new Error('QuotaExceededError');
      items.set(key, value);
    },
    removeItem(key: string): void {
      if (fails) throw new Error('SecurityError');
      items.delete(key);
    },
    get length(): number {
      if (fails) throw new Error('SecurityError');
      return items.size;
    },
    key(index: number): string | null {
      return [...items.keys()][index] ?? null;
    },
  };
}

describe('LocalStorageStore (ADR-0006 decisions 3, 5)', () => {
  it('reads and writes strings', () => {
    const backing = storage();
    const store = new LocalStorageStore(() => backing);
    expect(store.read('k')).toBeNull();
    expect(store.write('k', 'v')).toBe(true);
    expect(store.read('k')).toBe('v');
  });

  it('reports a throwing storage as unavailable, never as an error', () => {
    const store = new LocalStorageStore(() => storage(true));
    expect(store.read('k')).toBeNull();
    expect(store.write('k', 'v')).toBe(false);
  });

  it('reports storage that cannot even be reached as unavailable', () => {
    const store = new LocalStorageStore(() => {
      throw new Error('SecurityError'); // Reading `localStorage` itself throws when blocked.
    });
    expect(store.read('k')).toBeNull();
    expect(store.write('k', 'v')).toBe(false);
  });

  it('lists the keys under a prefix and removes one (ADR-0032 decision 2)', () => {
    const backing = storage();
    const store = new LocalStorageStore(() => backing);
    store.write('p.a', '1');
    store.write('other', '2');
    store.write('p.b', '3');
    expect(store.keys('p.')).toEqual(['p.a', 'p.b']);
    store.remove('p.a');
    expect(store.keys('p.')).toEqual(['p.b']);
    store.remove('absent');
    expect(store.read('other')).toBe('2');
  });

  it('skips a key removed during the scan', () => {
    // Two keys when the scan starts; the second is removed by another tab before it is read.
    const racing: StorageLike = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      length: 2,
      key: (index: number) => (index === 0 ? 'p.a' : null),
    };
    const store = new LocalStorageStore(() => racing);
    expect(store.keys('p.')).toEqual(['p.a']);
  });

  it('lists nothing and removes nothing, never throwing, when the storage throws', () => {
    expect(new LocalStorageStore(() => storage(true)).keys('p.')).toEqual([]);
    expect(() => {
      new LocalStorageStore(() => storage(true)).remove('k');
    }).not.toThrow();
    const blocked = new LocalStorageStore(() => {
      throw new Error('SecurityError');
    });
    expect(blocked.keys('p.')).toEqual([]);
    expect(() => {
      blocked.remove('k');
    }).not.toThrow();
  });
});
