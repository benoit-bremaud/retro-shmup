import { describe, expect, it } from 'vitest';
import { MAX_KEPT_RUNS, readKeptRuns } from '../../../src/domain/online/kept-runs';
import type { KeptRun } from '../../../src/domain/online/kept-runs';
import {
  OnlineRuns,
  STATUS_POLL_STEPS,
  STATUS_WATCH_STEPS,
} from '../../../src/domain/online/online-runs';
import type { Submission } from '../../../src/domain/ports/leaderboard-port';
import {
  clearKeptRuns,
  FakePort,
  MemoryStore,
  storeKeptRuns,
} from '../../support/leaderboard-fakes';

const ID = '01JC0000000000000000000001';
const ID2 = '01JC0000000000000000000002';
const TOKEN = 'b'.repeat(64);
const NOW = '2026-11-12T10:00:00.000Z';

const RUN: Submission = {
  seed: 7,
  records: new Uint8Array(5),
  frames: 1,
  score: 1200,
  name: 'ACE',
  country: 'FR',
};

function setup(stored: readonly KeptRun[] = []): {
  online: OnlineRuns;
  port: FakePort;
  store: MemoryStore;
} {
  const port = new FakePort();
  const store = new MemoryStore();
  storeKeptRuns(store, stored);
  return { online: new OnlineRuns(port, store, () => NOW), port, store };
}

function kept(store: MemoryStore): readonly KeptRun[] {
  return readKeptRuns(store);
}

function fullDocument(): KeptRun[] {
  return Array.from({ length: MAX_KEPT_RUNS }, (_, i) => ({
    id: `01JC${String(100 + i).padStart(22, '0')}`,
    token: TOKEN,
    score: i,
    sentAt: NOW,
    status: 'verified' as const,
  }));
}

describe('OnlineRuns — the offer', () => {
  it.each([
    ['game over', 'game-over', true, 1, true],
    ['run cleared', 'run-cleared', true, 1, true],
    ['a quit run', 'quit', true, 1, false],
    ['an overflowed recording', 'game-over', false, 1, false],
    ['a zero score', 'game-over', true, 0, false],
  ] as const)('offers after %s: %s', (_label, outcome, sendable, score, expected) => {
    expect(setup().online.offer({ outcome, sendable, score })).toBe(expected);
  });
});

describe('OnlineRuns — sending', () => {
  it('sends once, keeps the accepted run as pending and stores it', () => {
    const { online, port, store } = setup();
    expect(online.send(RUN)).toBe('sending');
    expect(online.send(RUN)).toBe('busy');
    expect(port.submitted).toEqual([RUN]);
    port.submits[0]?.done({ id: ID, token: TOKEN });
    online.step();
    expect(online.state()).toEqual({
      phase: 'sent',
      id: ID,
      status: 'pending',
      tokenMaybeLost: false,
    });
    expect(kept(store)).toEqual([
      { id: ID, token: TOKEN, score: 1200, sentAt: NOW, status: 'pending' },
    ]);
  });

  it('refuses to send with 20 runs kept, sending nothing', () => {
    const { online, port } = setup(fullDocument());
    expect(online.send(RUN)).toBe('full');
    expect(port.submitted).toEqual([]);
  });

  it.each([
    ['duplicate-run', true],
    ['accepted-unreadable', true],
    ['unsupported', false],
    ['offline', true],
    ['timeout', true],
    ['too-long', false],
    ['name-refused', false],
    ['rate-limited', false],
    ['server-error', false],
  ] as const)('keeps nothing on %s, never retrying, the token maybe lost: %s', (code, lost) => {
    const { online, port, store } = setup();
    online.send(RUN);
    port.submits[0]?.fail(code);
    online.step();
    online.step();
    expect(online.state()).toEqual({ phase: 'failed', error: code, tokenMaybeLost: lost });
    expect(port.submitted).toHaveLength(1);
    expect(kept(store)).toEqual([]);
    expect(online.send(RUN)).toBe('sending');
  });
});

describe('OnlineRuns — following the verification', () => {
  function sent(): ReturnType<typeof setup> {
    const context = setup();
    context.online.send(RUN);
    context.port.submits[0]?.done({ id: ID, token: TOKEN });
    context.online.step();
    return context;
  }

  it('asks the status every 15 s and stores the answer', () => {
    const { online, port, store } = sent();
    for (let i = 1; i < STATUS_POLL_STEPS; i += 1) online.step();
    expect(port.asked).toEqual([]);
    online.step();
    expect(port.asked).toEqual([ID]);
    port.statuses[0]?.done('verified');
    online.step();
    expect(online.state()).toEqual({
      phase: 'sent',
      id: ID,
      status: 'verified',
      tokenMaybeLost: false,
    });
    expect(kept(store)[0]?.status).toBe('verified');
    for (let i = 0; i < STATUS_POLL_STEPS * 2; i += 1) online.step();
    expect(port.asked).toEqual([ID]);
  });

  it('keeps asking while pending or on an error, and stops after 2 minutes', () => {
    const { online, port } = sent();
    for (let i = 0; i < STATUS_WATCH_STEPS + STATUS_POLL_STEPS; i += 1) {
      online.step();
      const last = port.statuses.at(-1);
      if (last?.handle.state === 'pending') {
        if (port.statuses.length % 2 === 0) last.done('pending');
        else last.fail('offline');
      }
    }
    expect(port.asked).toHaveLength(STATUS_WATCH_STEPS / STATUS_POLL_STEPS);
    expect(online.state()).toEqual({
      phase: 'sent',
      id: ID,
      status: 'pending',
      tokenMaybeLost: false,
    });
  });

  it('drops the run on 404', () => {
    const { online, port, store } = sent();
    for (let i = 0; i < STATUS_POLL_STEPS; i += 1) online.step();
    port.statuses[0]?.done('unknown');
    online.step();
    expect(kept(store)).toEqual([]);
  });
});

describe('OnlineRuns — Online scores', () => {
  function stored(): KeptRun[] {
    return [
      { id: ID, token: TOKEN, score: 5, sentAt: NOW, status: 'pending' },
      { id: ID2, token: TOKEN, score: 6, sentAt: NOW, status: 'verified' },
    ];
  }

  it('asks every kept run one at a time, newest first, and removes the unknown ones', () => {
    const { online, port, store } = setup(stored());
    online.refreshAll();
    online.step();
    expect(port.asked).toEqual([ID2]);
    port.statuses[0]?.done('expired');
    online.step();
    online.step();
    expect(port.asked).toEqual([ID2, ID]);
    port.statuses[1]?.done('unknown');
    online.step();
    expect(online.kept()).toEqual([
      { id: ID2, token: TOKEN, score: 6, sentAt: NOW, status: 'expired' },
    ]);
    expect(kept(store)).toEqual(online.kept());
  });

  it('does not bring back a run another tab erased when its status arrives (ADR-0032)', () => {
    const { online, port, store } = setup(stored());
    online.refreshAll();
    online.step();
    clearKeptRuns(store);
    port.statuses[0]?.done('verified');
    online.step();
    expect(kept(store)).toEqual([]);
    expect(online.kept()).toEqual([]);
  });

  it('lists every kept run past 20, sent from several tabs at once (ADR-0032)', () => {
    const { online } = setup([...fullDocument(), ...stored()]);
    online.refreshAll();
    expect(online.kept()).toHaveLength(MAX_KEPT_RUNS + 2);
    expect(online.full()).toBe(true);
  });

  it('erases with the token and drops the run once erased', () => {
    const { online, port, store } = setup(stored());
    expect(online.erase(ID)).toBe('erasing');
    expect(online.erase(ID)).toBe('busy');
    expect(online.erase('missing')).toBe('gone'); // gone wins over busy (GDD v0.37)
    expect(port.erased).toEqual([[ID, TOKEN]]);
    port.erases[0]?.done('erased');
    online.step();
    expect(kept(store).map((run) => run.id)).toEqual([ID2]);
    expect(online.erase(ID)).toBe('gone');
  });

  it('keeps the run when the erasure fails', () => {
    const { online, port } = setup(stored());
    online.erase(ID);
    port.erases[0]?.fail('offline');
    online.step();
    expect(online.kept()).toHaveLength(2);
    expect(online.eraseError()).toBe('offline');
    expect(online.state()).toEqual({ phase: 'idle' });
  });
});

describe('OnlineRuns — robustness', () => {
  function sentWith(store: MemoryStore, port: FakePort): OnlineRuns {
    const online = new OnlineRuns(port, store, () => NOW);
    online.send(RUN);
    port.submits.at(-1)?.done({ id: ID, token: TOKEN });
    online.step();
    return online;
  }

  it('never overwrites the runs another tab kept', () => {
    const store = new MemoryStore();
    const port = new FakePort();
    const older = new OnlineRuns(port, store, () => NOW);
    sentWith(store, port);
    older.send({ ...RUN, score: 7 });
    port.submits.at(-1)?.done({ id: ID2, token: TOKEN });
    older.step();
    expect(kept(store).map((run) => run.id)).toEqual([ID2, ID]);
  });

  it('keeps an accepted run although another tab filled the 20 meanwhile (ADR-0032)', () => {
    const { online, port, store } = setup();
    online.send(RUN);
    storeKeptRuns(store, fullDocument());
    port.submits[0]?.done({ id: ID, token: TOKEN });
    online.step();
    expect(kept(store)).toHaveLength(MAX_KEPT_RUNS + 1);
    expect(online.state()).toEqual({
      phase: 'sent',
      id: ID,
      status: 'pending',
      tokenMaybeLost: false,
    });
  });

  it('flags the token as maybe lost when it cannot be stored', () => {
    const store = new MemoryStore();
    store.write = () => false;
    const online = sentWith(store, new FakePort());
    expect(online.state()).toEqual({
      phase: 'sent',
      id: ID,
      status: 'pending',
      tokenMaybeLost: true,
    });
  });

  it('serves a player action before the rest of the refresh queue', () => {
    const { online, port } = setup([
      { id: ID, token: TOKEN, score: 5, sentAt: NOW, status: 'pending' },
      { id: ID2, token: TOKEN, score: 6, sentAt: NOW, status: 'pending' },
    ]);
    online.refreshAll();
    online.step();
    expect(online.erase(ID)).toBe('erasing');
    expect(online.erase(ID)).toBe('busy');
    expect(online.send(RUN)).toBe('busy');
    port.statuses[0]?.done('pending');
    online.step();
    expect(port.erased).toEqual([[ID, TOKEN]]);
    expect(port.asked).toEqual([ID2]);
  });

  it('stops asking once the player leaves, and a new offer starts idle', () => {
    const port = new FakePort();
    const online = sentWith(new MemoryStore(), port);
    online.leave();
    for (let i = 0; i < STATUS_WATCH_STEPS; i += 1) online.step();
    expect(port.asked).toEqual([]);
    online.send(RUN);
    port.submits.at(-1)?.fail('offline');
    online.step();
    expect(online.offer({ outcome: 'game-over', sendable: true, score: 1 })).toBe(true);
    expect(online.state()).toEqual({ phase: 'idle' });
  });

  it('stops watching a run once it is erased', () => {
    const port = new FakePort();
    const online = sentWith(new MemoryStore(), port);
    online.erase(ID);
    port.erases[0]?.done('erased');
    online.step();
    for (let i = 0; i < STATUS_POLL_STEPS; i += 1) online.step();
    expect(port.asked).toEqual([]);
    expect(online.kept()).toEqual([]);
  });

  it('keeps a run accepted after the player left, without following it', () => {
    const { online, port, store } = setup();
    online.send(RUN);
    online.leave();
    port.submits[0]?.done({ id: ID, token: TOKEN });
    for (let i = 0; i <= STATUS_POLL_STEPS; i += 1) online.step();
    expect(port.asked).toEqual([]);
    expect(kept(store).map((run) => run.id)).toEqual([ID]);
    expect(online.state()).toEqual({ phase: 'idle' });
  });
});
