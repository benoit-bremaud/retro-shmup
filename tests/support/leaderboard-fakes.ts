import type {
  Accepted,
  Erased,
  FailureCode,
  LeaderboardPort,
  RequestHandle,
  StatusAnswer,
  Submission,
} from '../../src/domain/ports/leaderboard-port';
import type { StoragePort } from '../../src/domain/ports/storage-port';
import { KEPT_RUN_PREFIX } from '../../src/domain/online/kept-runs';
import type { KeptRun } from '../../src/domain/online/kept-runs';

/** A handle the test settles by hand, as the adapter does when `fetch` ends. */
export class Settable<T> {
  handle: RequestHandle<T> = { state: 'pending' };
  done(result: T): void {
    this.handle = { state: 'done', result };
  }
  fail(error: FailureCode): void {
    this.handle = { state: 'failed', error };
  }
}

/** Stands for the leaderboard: records each request, settled by hand through its `Settable`. */
export class FakePort implements LeaderboardPort {
  readonly submitted: Submission[] = [];
  readonly asked: string[] = [];
  readonly erased: [string, string][] = [];
  readonly submits: Settable<Accepted>[] = [];
  readonly statuses: Settable<StatusAnswer>[] = [];
  readonly erases: Settable<Erased>[] = [];

  submit(run: Submission): RequestHandle<Accepted> {
    this.submitted.push(run);
    return this.track(this.submits);
  }
  status(id: string): RequestHandle<StatusAnswer> {
    this.asked.push(id);
    return this.track(this.statuses);
  }
  erase(id: string, token: string): RequestHandle<Erased> {
    this.erased.push([id, token]);
    return this.track(this.erases);
  }
  // The domain reads `handle` through a getter so a later settle is seen.
  private track<T>(list: Settable<T>[]): RequestHandle<T> {
    const settable = new Settable<T>();
    list.push(settable);
    return {
      get state() {
        return settable.handle.state;
      },
      get result() {
        return settable.handle.state === 'done' ? settable.handle.result : undefined;
      },
      get error() {
        return settable.handle.state === 'failed' ? settable.handle.error : undefined;
      },
    } as unknown as RequestHandle<T>;
  }
}

/** The browser storage in memory; `refuse` makes every write fail. */
export class MemoryStore implements StoragePort {
  readonly values = new Map<string, string>();
  read(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  refuse = false;
  write(key: string, value: string): boolean {
    if (this.refuse) return false;
    this.values.set(key, value);
    return true;
  }
  keys(prefix: string): readonly string[] {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }
  remove(key: string): void {
    this.values.delete(key);
  }
}

/** Stores `runs` as another tab would: one key per run (ADR-0032), bypassing any refusal. */
export function storeKeptRuns(store: MemoryStore, runs: readonly KeptRun[]): void {
  for (const { id, token, score, sentAt, status } of runs) {
    store.values.set(KEPT_RUN_PREFIX + id, JSON.stringify({ token, score, sentAt, status }));
  }
}

/** Removes every kept run's key, as erasing them all from another tab would. */
export function clearKeptRuns(store: MemoryStore): void {
  for (const key of store.keys(KEPT_RUN_PREFIX)) store.values.delete(key);
}
