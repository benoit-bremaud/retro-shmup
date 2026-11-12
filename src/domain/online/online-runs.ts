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

/**
 * What the send screen shows: built on a transition only, never per step. `tokenMaybeLost` asks
 * for *TO ERASE SEE PRIVACY*: the run may be stored without a token the game could keep.
 */
export type OnlineState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'sending' }
  | {
      readonly phase: 'sent';
      readonly id: string;
      readonly status: RunStatus;
      readonly tokenMaybeLost: boolean;
    }
  | { readonly phase: 'failed'; readonly error: FailureCode; readonly tokenMaybeLost: boolean };

/** The one open request (decision 20: one at a time). */
type OpenRequest =
  | { readonly kind: 'submit'; readonly handle: RequestHandle<Accepted>; readonly score: number }
  | { readonly kind: 'status'; readonly handle: RequestHandle<StatusAnswer>; readonly id: string }
  | { readonly kind: 'erase'; readonly handle: RequestHandle<Erased>; readonly id: string };

/** A player action waiting for the refresh in flight: it goes before the rest of the queue. */
type PlayerAction =
  | { readonly kind: 'submit'; readonly run: Submission }
  | { readonly kind: 'erase'; readonly id: string; readonly token: string };

/** A failed `POST` that may still have stored the run: its token is lost (decision 19). */
const MAYBE_STORED: readonly FailureCode[] = [
  'offline',
  'timeout',
  'duplicate-run',
  'accepted-unreadable',
];

const IDLE: OnlineState = { phase: 'idle' };
const SENDING: OnlineState = { phase: 'sending' };

/**
 * Sending runs, following their verification and erasing them (meta/04-class-online-runs,
 * meta/05-state-online-run). The scene machine calls `step` once per simulation step; the port's
 * handles are read there, never awaited. A `POST` is never retried on its own. The kept runs are
 * re-read before every change, so a second tab never overwrites a token.
 */
export class OnlineRuns {
  private runs: KeptRuns;
  private open: OpenRequest | undefined;
  private action: PlayerAction | undefined;
  private current: OnlineState = IDLE;
  private eraseFailure: FailureCode | undefined;
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
    this.runs = this.load();
  }

  /** Whether *Send online* is offered for this run (decision 13); starts its screen afresh. */
  offer(result: RunResult): boolean {
    this.current = IDLE;
    return result.outcome !== 'quit' && result.sendable && result.score > 0;
  }

  /** *SEND*: `full` with 20 runs kept, `busy` while another send or erase is under way. */
  send(run: Submission): 'sending' | 'full' | 'busy' {
    this.runs = this.load();
    if (this.runs.full()) return 'full';
    if (!this.start({ kind: 'submit', run })) return 'busy';
    this.current = SENDING;
    return 'sending';
  }

  /** *Online scores* opened: asks every kept run, one at a time. */
  refreshAll(): void {
    this.runs = this.load();
    this.refreshQueue.length = 0;
    const items = this.runs.items;
    for (let i = 0; i < items.length; i += 1) this.refreshQueue.push(items[i]?.id ?? '');
  }

  /** The player left the send or *Online scores* screen: no more status requests. */
  leave(): void {
    this.watched = undefined;
    this.refreshQueue.length = 0;
    this.current = IDLE;
  }

  /** Erases a kept run after the player confirmed; false when unknown or another action runs. */
  erase(id: string): boolean {
    const run = this.find(id);
    if (run === undefined) return false;
    this.eraseFailure = undefined;
    return this.start({ kind: 'erase', id, token: run.token });
  }

  kept(): readonly KeptRun[] {
    return this.runs.items;
  }

  state(): OnlineState {
    return this.current;
  }

  /** Why the last erasure failed, for *Online scores*; `undefined` when none did. */
  eraseError(): FailureCode | undefined {
    return this.eraseFailure;
  }

  /** One simulation step: settles the open request, then opens the next one due. */
  step(): void {
    if (this.watched !== undefined) {
      this.watched.steps += 1;
      if (this.watched.steps > STATUS_WATCH_STEPS) this.watched = undefined;
    }
    this.settle();
    if (this.open !== undefined) return;
    const action = this.action;
    if (action !== undefined) {
      this.action = undefined;
      this.begin(action);
      return;
    }
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

  /** Starts a player action now, or after the status request in flight; false when busy. */
  private start(action: PlayerAction): boolean {
    if (this.action !== undefined || (this.open !== undefined && this.open.kind !== 'status')) {
      return false;
    }
    if (this.open === undefined) this.begin(action);
    else this.action = action;
    return true;
  }

  private begin(action: PlayerAction): void {
    this.open =
      action.kind === 'submit'
        ? { kind: 'submit', handle: this.port.submit(action.run), score: action.run.score }
        : { kind: 'erase', handle: this.port.erase(action.id, action.token), id: action.id };
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
          if (this.watched?.id === open.id) this.watched = undefined;
          this.change((runs) => {
            runs.drop(open.id);
            return true;
          });
        } else {
          this.eraseFailure = open.handle.error;
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
    const run: KeptRun = { id, token, score, sentAt: this.now(), status: 'pending' };
    // A token that could not be kept (storage full or blocked) cannot erase the run later.
    const kept = this.change((runs) => runs.add(run));
    this.current = { phase: 'sent', id, status: 'pending', tokenMaybeLost: !kept };
    this.watched = { id, steps: 0 };
  }

  private settleStatus(id: string, answer: StatusAnswer): void {
    const isWatched = this.watched?.id === id;
    this.change((runs) => {
      if (answer === 'unknown') runs.drop(id);
      else runs.setStatus(id, answer);
      return true;
    });
    if (!isWatched) return;
    if (answer === 'unknown') {
      this.watched = undefined;
      this.current = IDLE;
      return;
    }
    if (answer !== 'pending') this.watched = undefined;
    const lost = this.current.phase === 'sent' && this.current.tokenMaybeLost;
    this.current = { phase: 'sent', id, status: answer, tokenMaybeLost: lost };
  }

  private find(id: string): KeptRun | undefined {
    this.runs = this.load();
    return this.runs.items.find((run) => run.id === id);
  }

  private load(): KeptRuns {
    return parseKeptRuns(this.storage.read(KEPT_RUNS_KEY));
  }

  /**
   * Read, change, write: another tab's runs are re-read first and never overwritten. True only
   * when `apply` accepted the change and the write succeeded.
   */
  private change(apply: (runs: KeptRuns) => boolean): boolean {
    this.runs = this.load();
    const accepted = apply(this.runs);
    return this.storage.write(KEPT_RUNS_KEY, serializeKeptRuns(this.runs)) && accepted;
  }
}
