/**
 * String key-value persistence (ADR-0006). The save schema belongs to the domain;
 * unavailability is a normal outcome, not an error.
 */
export interface StoragePort {
  /** `null` when the key is absent or storage is unavailable. */
  read(key: string): string | null;
  /** `false` when persistence is unavailable. */
  write(key: string, value: string): boolean;
}
