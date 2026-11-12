import { STEPS_PER_SECOND } from '../game/tuning';
import type {
  Accepted,
  Erased,
  FailureCode,
  LeaderboardPort,
  RequestHandle,
  RunStatus,
  StatusAnswer,
  Submission,
} from '../ports/leaderboard-port';
import type { StoragePort } from '../ports/storage-port';
import { KEPT_RUNS_KEY, parseKeptRuns, serializeKeptRuns } from './kept-runs';
import type { KeptRun, KeptRuns } from './kept-runs';

/** The status is asked every 15 s (ADR-0031 decision 16)… */
export const STATUS_POLL_STEPS = 15 * STEPS_PER_SECOND;
/** …for 2 minutes at most after the run was accepted. */
export const STATUS_WATCH_STEPS = 120 * STEPS_PER_SECOND;

/** How the run ended, as the offer needs it (decision 13). */
export interface RunResult {
  readonly outcome: 'game-over' | 'run-cleared' | 'quit';
  /** The recording has records and did not overflow. */
  readonly sendable: boolean;
  readonly score: number;
}

/** What the screens show: built on a transition only, never per step. */
export type OnlineState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'sending' }
  | { readonly phase: 'sent'; readonly id: string; readonly status: RunStatus }
  | { readonly phase: 'failed'; readonly error: FailureCode; readonly tokenMaybeLost: boolean };

/** The one open request (decision 20: one at a time). */
type OpenRequest =
  | { readonly kind: 'submit'; readonly handle: RequestHandle<Accepted>; readonly score: number }
  | { readonly kind: 'status'; readonly handle: RequestHandle<StatusAnswer>; readonly id: string }
  | { readonly kind: 'erase'; readonly handle: RequestHandle<Erased>; readonly id: string };

/** A failed `POST` that may still have stored the run: a re-send answers 409 (decision 19). */
const MAYBE_STORED: readonly FailureCode[] = ['offline', 'timeout', 'duplicate-run'];

const IDLE: OnlineState = { phase: 'idle' };
const SENDING: OnlineState = { phase: 'sending' };

/**
 * Sending runs, following their verification and erasing them (meta/04-class-online-runs,
 * meta/05-state-online-run). The scene machine calls `step` once per simulation step; the port's
 * handles are read there, never awaited. A `POST` is never retried on its own.
 */
export class OnlineRuns {
  private readonly runs: KeptRuns;
  private open: OpenRequest | undefined;
  private current: OnlineState = IDLE;
  /** The run accepted on this screen and the steps since: its status is asked every 15 s. */
  private watched: { readonly id: string; steps: number } | undefined;
  private readonly refreshQueue: string[] = [];

  private readonly port: LeaderboardPort;
  private readonly storage: StoragePort;
  private readonly now: () => string;

  /** `now` gives the ISO date a run is kept with (the domain never reads the clock itself). */
  constructor(port: LeaderboardPort, storage: StoragePort, now: () => string) {
    this.port = port;
    this.storage = storage;
    this.now = now;
    this.runs = parseKeptRuns(storage.read(KEPT_RUNS_KEY));
  }

  /** Whether *Send online* is offered for this run (decision 13). */
  offer(result: RunResult): boolean {
    return result.outcome !== 'quit' && result.sendable && result.score > 0;
  }

  /** *SEND*: `full` with 20 runs kept, `busy` while a request is open. */
  send(run: Submission): 'sending' | 'full' | 'busy' {
    if (this.runs.full()) return 'full';
    if (this.open !== undefined) return 'busy';
    this.open = { kind: 'submit', handle: this.port.submit(run), score: run.score };
    this.current = SENDING;
    return 'sending';
  }

  /** *Online scores* opened: asks every kept run, one at a time. */
  refreshAll(): void {
    this.refreshQueue.length = 0;
    const items = this.runs.items;
    for (let i = 0; i < items.length; i += 1) this.refreshQueue.push(items[i]?.id ?? '');
  }

  /** Erases a kept run after the player confirmed; false when unknown or a request is open. */
  erase(id: string): boolean {
    const run = this.find(id);
    if (run === undefined || this.open !== undefined) return false;
    this.open = { kind: 'erase', handle: this.port.erase(id, run.token), id };
    return true;
  }

  kept(): readonly KeptRun[] {
    return this.runs.items;
  }

  state(): OnlineState {
    return this.current;
  }

  /** One simulation step: settles the open request, then opens the next one due. */
  step(): void {
    if (this.watched !== undefined) {
      this.watched.steps += 1;
      if (this.watched.steps > STATUS_WATCH_STEPS) this.watched = undefined;
    }
    this.settle();
    if (this.open !== undefined) return;
    const next = this.refreshQueue.shift();
    if (next !== undefined) {
      this.open = { kind: 'status', handle: this.port.status(next), id: next };
    } else if (
      this.watched !== undefined &&
      this.watched.steps > 0 &&
      this.watched.steps % STATUS_POLL_STEPS === 0
    ) {
      const id = this.watched.id;
      this.open = { kind: 'status', handle: this.port.status(id), id };
    }
  }

  private settle(): void {
    const open = this.open;
    if (open === undefined || open.handle.state === 'pending') return;
    this.open = undefined;
    switch (open.kind) {
      case 'submit':
        this.settleSubmit(open.handle, open.score);
        return;
      case 'status':
        if (open.handle.state === 'done') this.settleStatus(open.id, open.handle.result);
        return;
      case 'erase':
        if (open.handle.state === 'done') {
          this.runs.drop(open.id);
          this.save();
        } else {
          this.current = { phase: 'failed', error: open.handle.error, tokenMaybeLost: false };
        }
    }
  }

  private settleSubmit(handle: RequestHandle<Accepted>, score: number): void {
    if (handle.state === 'failed') {
      const tokenMaybeLost = MAYBE_STORED.includes(handle.error);
      this.current = { phase: 'failed', error: handle.error, tokenMaybeLost };
      return;
    }
    if (handle.state !== 'done') return;
    const { id, token } = handle.result;
    this.runs.add({ id, token, score, sentAt: this.now(), status: 'pending' });
    this.save();
    this.current = { phase: 'sent', id, status: 'pending' };
    this.watched = { id, steps: 0 };
  }

  private settleStatus(id: string, answer: StatusAnswer): void {
    const isWatched = this.watched?.id === id;
    if (answer === 'unknown') {
      this.runs.drop(id);
      if (isWatched) {
        this.watched = undefined;
        this.current = IDLE;
      }
    } else {
      this.runs.setStatus(id, answer);
      if (isWatched) {
        if (answer !== 'pending') this.watched = undefined;
        this.current = { phase: 'sent', id, status: answer };
      }
    }
    this.save();
  }

  private find(id: string): KeptRun | undefined {
    return this.runs.items.find((run) => run.id === id);
  }

  private save(): void {
    this.storage.write(KEPT_RUNS_KEY, serializeKeptRuns(this.runs));
  }
}
