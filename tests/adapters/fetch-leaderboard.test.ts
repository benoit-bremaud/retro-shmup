import { describe, expect, it } from 'vitest';
import { FetchLeaderboard, MAX_INPUTS_LENGTH } from '../../src/adapters/fetch-leaderboard';
import type { FetchLike } from '../../src/adapters/fetch-leaderboard';
import type { RequestHandle, Submission } from '../../src/domain/ports/leaderboard-port';

const ORIGIN = 'https://lb.example.test';
const ID = '01JC0000000000000000000001';
const TOKEN = 'c'.repeat(64);
const RUN: Submission = {
  seed: 42,
  records: Uint8Array.from([0b0101, 127, 0, 0x81, 0xff]),
  frames: 1,
  score: 900,
  name: 'ACE',
  country: 'FR',
};

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A ready answer of `status` with `body` as JSON. */
function reply(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(json(status, body));
}

function bodyOf(call: Call | undefined): string {
  const body = call?.init.body;
  return typeof body === 'string' ? body : '';
}

/** A `fetch` answering `answer` and recording every call. */
function fakeFetch(answer: () => Promise<Response>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init });
    return answer();
  };
  return { fetch, calls };
}

function leaderboard(answer: () => Promise<Response>): {
  board: FetchLeaderboard;
  calls: Call[];
} {
  const { fetch, calls } = fakeFetch(answer);
  return {
    board: new FetchLeaderboard(ORIGIN, '1.2.3', fetch, () => Promise.resolve('ENCODED')),
    calls,
  };
}

/** Lets every pending promise of the adapter run. */
async function settled<T>(handle: RequestHandle<T>): Promise<RequestHandle<T>> {
  for (let i = 0; i < 10 && handle.state === 'pending'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return handle;
}

describe('FetchLeaderboard — submit', () => {
  it('posts the run as JSON without credentials and keeps the id and token', async () => {
    const { board, calls } = leaderboard(() =>
      reply(202, { id: ID, deletionToken: TOKEN, extra: 1 }),
    );
    const handle = board.submit(RUN);
    expect(handle.state).toBe('pending');
    expect(await settled(handle)).toEqual({ state: 'done', result: { id: ID, token: TOKEN } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ORIGIN}/v1/runs`);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(calls[0]?.init.cache).toBe('no-store');
    expect(calls[0]?.init.redirect).toBe('error');
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(bodyOf(calls[0]))).toEqual({
      game: 'shmup',
      mode: 'arcade',
      version: '1.2.3',
      seed: 42,
      codec: 1,
      frames: 1,
      inputs: 'ENCODED',
      score: 900,
      name: 'ACE',
      country: 'FR',
    });
  });

  it('leaves the country out when the player chose none', async () => {
    const { board, calls } = leaderboard(() => reply(202, { id: ID, deletionToken: TOKEN }));
    const { country: _country, ...withoutCountry } = RUN;
    await settled(board.submit(withoutCountry));
    expect(JSON.parse(bodyOf(calls[0]))).not.toHaveProperty('country');
  });

  it('refuses inputs over 60 000 characters without sending', async () => {
    const { fetch, calls } = fakeFetch(() => reply(202, {}));
    const long = 'A'.repeat(MAX_INPUTS_LENGTH + 1);
    const board = new FetchLeaderboard(ORIGIN, '1.2.3', fetch, () => Promise.resolve(long));
    expect(await settled(board.submit(RUN))).toEqual({ state: 'failed', error: 'too-long' });
    expect(calls).toEqual([]);
  });

  it('fails as unsupported when the encoder throws', async () => {
    const { fetch } = fakeFetch(() => reply(202, {}));
    const board = new FetchLeaderboard(ORIGIN, '1.2.3', fetch, () => Promise.reject(new Error()));
    expect(await settled(board.submit(RUN))).toEqual({ state: 'failed', error: 'unsupported' });
  });

  it.each([
    ['a 202 without a token', { id: ID }],
    ['a 202 with a malformed id', { id: 'x', deletionToken: TOKEN }],
    ['a 202 with an uppercase token', { id: ID, deletionToken: TOKEN.toUpperCase() }],
  ])('reports %s as accepted but unreadable', async (_label, body) => {
    const { board } = leaderboard(() => reply(202, body));
    expect(await settled(board.submit(RUN))).toEqual({
      state: 'failed',
      error: 'accepted-unreadable',
    });
  });

  it.each([
    ['a 200 instead of 202', 200, { id: ID, deletionToken: TOKEN }],
    ['a 500', 500, { error: 'internal' }],
    ['a 418', 418, {}],
  ])('maps %s to server-error', async (_label, status, body) => {
    const { board } = leaderboard(() => reply(status, body));
    expect(await settled(board.submit(RUN))).toEqual({ state: 'failed', error: 'server-error' });
  });

  it.each([
    [409, { error: 'duplicate-run' }, 'duplicate-run'],
    [400, { error: 'unknown-version' }, 'unknown-version'],
    [400, { error: 'name-refused' }, 'name-refused'],
    [400, { error: 'body-too-large' }, 'too-long'],
    [413, {}, 'too-long'],
    [400, { error: 'bad-schema' }, 'bad-request'],
    [400, 'not an object', 'bad-request'],
    [429, {}, 'rate-limited'],
  ] as const)('maps %i %j to %s', async (status, body, error) => {
    const { board } = leaderboard(() => reply(status, body));
    expect(await settled(board.submit(RUN))).toEqual({ state: 'failed', error });
  });

  it('maps a body that is not JSON to its status', async () => {
    const { board } = leaderboard(() => Promise.resolve(new Response('<html>', { status: 400 })));
    expect(await settled(board.submit(RUN))).toEqual({ state: 'failed', error: 'bad-request' });
  });

  it.each([
    ['a timeout', new DOMException('late', 'TimeoutError'), 'timeout'],
    ['a network failure', new TypeError('Failed to fetch'), 'offline'],
  ])('maps %s to its code', async (_label, failure, error) => {
    const { board } = leaderboard(() => Promise.reject(failure));
    expect(await settled(board.submit(RUN))).toEqual({ state: 'failed', error });
  });
});

describe('FetchLeaderboard — status', () => {
  it('reads the status of a run', async () => {
    const { board, calls } = leaderboard(() => reply(200, { id: ID, status: 'verified' }));
    expect(await settled(board.status(ID))).toEqual({ state: 'done', result: 'verified' });
    expect(calls[0]?.url).toBe(`${ORIGIN}/v1/runs/${ID}`);
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.credentials).toBe('omit');
  });

  it('answers unknown on 404', async () => {
    const { board } = leaderboard(() => reply(404, {}));
    expect(await settled(board.status(ID))).toEqual({ state: 'done', result: 'unknown' });
  });

  it('fails on an unknown status', async () => {
    const { board } = leaderboard(() => reply(200, { status: 'lost' }));
    expect(await settled(board.status(ID))).toEqual({ state: 'failed', error: 'server-error' });
  });

  it('never sends an id that is not a ULID', async () => {
    const { board, calls } = leaderboard(() => reply(200, { status: 'verified' }));
    expect(await settled(board.status('../admin'))).toEqual({
      state: 'failed',
      error: 'bad-request',
    });
    expect(calls).toEqual([]);
  });
});

describe('FetchLeaderboard — erase', () => {
  it.each([204, 404])('erases with the bearer token, done on %i', async (status) => {
    const { board, calls } = leaderboard(() => Promise.resolve(new Response(null, { status })));
    expect(await settled(board.erase(ID, TOKEN))).toEqual({ state: 'done', result: 'erased' });
    expect(calls[0]?.url).toBe(`${ORIGIN}/v1/runs/${ID}`);
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(new Headers(calls[0]?.init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('fails on a refusal', async () => {
    const { board } = leaderboard(() => reply(429, {}));
    expect(await settled(board.erase(ID, TOKEN))).toEqual({
      state: 'failed',
      error: 'rate-limited',
    });
  });

  it('never sends an id that is not a ULID', async () => {
    const { board, calls } = leaderboard(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    expect((await settled(board.erase('x/y', TOKEN))).state).toBe('failed');
    expect(calls).toEqual([]);
  });
});
