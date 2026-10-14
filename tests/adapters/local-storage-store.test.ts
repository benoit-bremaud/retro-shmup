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
});
