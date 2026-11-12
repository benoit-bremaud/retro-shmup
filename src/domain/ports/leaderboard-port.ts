/**
 * The online leaderboard (ADR-0031 decision 20, meta/04-class-online-runs). Every call returns a
 * handle the domain reads once per step: no promise reaches the domain.
 */

/** What the verifier has said about a sent run. */
export type RunStatus = 'pending' | 'verified' | 'rejected' | 'unverifiable' | 'expired';

/**
 * Why a request failed, by the server's stable code or the transport (decision 15).
 * `accepted-unreadable`: the server answered `202` (the run is stored) but its body could not be
 * read, so the token is lost; `unsupported`: this browser cannot encode the run.
 */
export type FailureCode =
  | 'offline'
  | 'accepted-unreadable'
  | 'unsupported'
  | 'timeout'
  | 'too-long'
  | 'duplicate-run'
  | 'unknown-version'
  | 'name-refused'
  | 'bad-request'
  | 'rate-limited'
  | 'server-error';

/** A request in flight, settled by the adapter when its answer arrives. */
export type RequestHandle<T> =
  | { readonly state: 'pending' }
  | { readonly state: 'done'; readonly result: T }
  | { readonly state: 'failed'; readonly error: FailureCode };

/** A finished run to send: its seed, records and what the player chose to show. */
export interface Submission {
  readonly seed: number;
  readonly records: Uint8Array;
  readonly frames: number;
  readonly score: number;
  readonly name: string;
  readonly country?: string;
}

/** The server kept the run: its id and the token that erases it (decision 15). */
export interface Accepted {
  readonly id: string;
  readonly token: string;
}

/** A status answer; `unknown` is a `404`, the run erased or never stored. */
export type StatusAnswer = RunStatus | 'unknown';

/** `DELETE` answered `204` or `404`: the run is gone. */
export type Erased = 'erased';

export interface LeaderboardPort {
  submit(run: Submission): RequestHandle<Accepted>;
  status(id: string): RequestHandle<StatusAnswer>;
  erase(id: string, token: string): RequestHandle<Erased>;
}
