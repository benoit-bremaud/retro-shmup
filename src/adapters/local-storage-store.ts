import type { StoragePort } from '../domain/ports/storage-port';

/** The part of Web Storage the adapter uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

/**
 * `StoragePort` over `localStorage` (ADR-0006 decisions 3 and 5). It owns nothing but the browser
 * call: every access, reaching the storage included, can throw (blocked site data, private mode,
 * full quota), so each is wrapped and reported as "unavailable", never as an error.
 */
export class LocalStorageStore implements StoragePort {
  private readonly storage: () => StorageLike;

  /** `storage` is called on each access, because reading `localStorage` itself may throw. */
  constructor(storage: () => StorageLike) {
    this.storage = storage;
  }

  read(key: string): string | null {
    try {
      return this.storage().getItem(key);
    } catch {
      return null;
    }
  }

  write(key: string, value: string): boolean {
    try {
      this.storage().setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  keys(prefix: string): readonly string[] {
    try {
      const storage = this.storage();
      const found: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        // Another tab may remove a key while we scan: `key` then answers null.
        if (key?.startsWith(prefix) === true) found.push(key);
      }
      return found;
    } catch {
      return [];
    }
  }

  remove(key: string): void {
    try {
      this.storage().removeItem(key);
    } catch {
      // Unavailable storage: the key stays, and the next status request finds the run gone.
    }
  }
}
