import type {
  Accepted,
  Erased,
  FailureCode,
  LeaderboardPort,
  RequestHandle,
  RunStatus,
  StatusAnswer,
  Submission,
} from '../domain/ports/leaderboard-port';

/** The game sends only when the encoded inputs fit (ADR-0031 decision 6). */
export const MAX_INPUTS_LENGTH = 60_000;
const TIMEOUT_MS = 10_000;

/** The part of `fetch` the adapter uses. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Encodes the records as codec 1 text (the browser encoder in production). */
export type Encoder = (records: Uint8Array, frames: number) => Promise<string>;

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const STATUSES: readonly RunStatus[] = [
  'pending',
  'verified',
  'rejected',
  'unverifiable',
  'expired',
];

/** The server's stable `400` codes the game shows its own line for (retro-leaderboard#14). */
const BAD_REQUEST_CODES: Readonly<Record<string, FailureCode>> = {
  'unknown-version': 'unknown-version',
  'name-refused': 'name-refused',
  'body-too-large': 'too-long',
};

/** A failure decided before or instead of a usable answer. */
class Failure extends Error {
  readonly code: FailureCode;
  constructor(code: FailureCode) {
    super(code);
    this.code = code;
  }
}

/**
 * `LeaderboardPort` over `fetch` (ADR-0031 decisions 15 and 20, meta/04-class-online-runs): JSON
 * only, `credentials: 'omit'`, a 10 s timeout, every answer parsed by allowlist; a 2xx that fails
 * the parse is a `server-error`. Each call returns a handle at once and settles it later; nothing
 * throws and no `POST` is retried.
 */
export class FetchLeaderboard implements LeaderboardPort {
  private readonly origin: string;
  private readonly version: string;
  private readonly fetch: FetchLike;
  private readonly encode: Encoder;

  constructor(origin: string, version: string, fetch: FetchLike, encode: Encoder) {
    this.origin = origin;
    this.version = version;
    this.fetch = fetch;
    this.encode = encode;
  }

  submit(run: Submission): RequestHandle<Accepted> {
    return this.track(async () => {
      let inputs: string;
      try {
        inputs = await this.encode(run.records, run.frames);
      } catch {
        throw new Failure('unsupported'); // no CompressionStream, for instance
      }
      if (inputs.length > MAX_INPUTS_LENGTH) throw new Failure('too-long');
      const body = {
        game: 'shmup',
        mode: 'arcade',
        version: this.version,
        seed: run.seed,
        codec: 1,
        frames: run.frames,
        inputs,
        score: run.score,
        name: run.name,
        ...(run.country === undefined ? {} : { country: run.country }),
      };
      const response = await this.request('/v1/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.status !== 202) throw await failureOf(response);
      // From here the run is stored: an unreadable body loses its token (decision 19).
      const answer = await readJson(response);
      const id = field(answer, 'id');
      const token = field(answer, 'deletionToken');
      if (typeof id !== 'string' || !ULID.test(id)) throw new Failure('accepted-unreadable');
      if (typeof token !== 'string' || !TOKEN.test(token)) {
        throw new Failure('accepted-unreadable');
      }
      return { id, token };
    });
  }

  status(id: string): RequestHandle<StatusAnswer> {
    return this.track(async () => {
      const response = await this.request(runPath(id), { method: 'GET' });
      if (response.status === 404) return 'unknown';
      if (response.status !== 200) throw await failureOf(response);
      const status = field(await readJson(response), 'status');
      const known = STATUSES.find((candidate) => candidate === status);
      if (known === undefined) throw new Failure('server-error');
      return known;
    });
  }

  erase(id: string, token: string): RequestHandle<Erased> {
    return this.track(async () => {
      const response = await this.request(runPath(id), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 204 || response.status === 404) return 'erased' as const;
      throw await failureOf(response);
    });
  }

  /** Runs `work` and settles the returned handle with its result or failure code. */
  private track<T>(work: () => Promise<T>): RequestHandle<T> {
    const handle: RequestHandle<T> = { state: 'pending' };
    work().then(
      (result) => Object.assign(handle, { state: 'done', result }),
      (error: unknown) =>
        Object.assign(handle, {
          state: 'failed',
          error: error instanceof Failure ? error.code : 'server-error',
        }),
    );
    return handle;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetch(`${this.origin}${path}`, {
        ...init,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error: unknown) {
      // `name` is inherited (DOMException), so it is read through the prototype chain.
      const timedOut = Reflect.get(Object(error), 'name') === 'TimeoutError';
      throw new Failure(timedOut ? 'timeout' : 'offline');
    }
  }
}

/** The path of a run; an id that is not a ULID is never put in a URL. */
function runPath(id: string): string {
  if (!ULID.test(id)) throw new Failure('bad-request');
  return `/v1/runs/${id}`;
}

async function failureOf(response: Response): Promise<Failure> {
  switch (response.status) {
    case 409:
      return new Failure('duplicate-run');
    case 413:
      return new Failure('too-long');
    case 429:
      return new Failure('rate-limited');
    case 400: {
      const code = field(await readJson(response), 'error');
      const known = typeof code === 'string' ? BAD_REQUEST_CODES[code] : undefined;
      return new Failure(known ?? 'bad-request');
    }
    default:
      return new Failure('server-error');
  }
}

/** The JSON body, or `undefined` when it is not JSON (never throws). */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null && Object.hasOwn(value, name)
    ? Reflect.get(value, name)
    : undefined;
}
