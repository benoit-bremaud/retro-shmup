import type { StoragePort } from '../domain/ports/storage-port';

/** The part of Web Storage the adapter uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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
}
