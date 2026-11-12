import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import { MAX_RECORDED_STEPS, quantizeIntent } from '../../src/domain/replay/record';
import { RunRecorder } from '../../src/domain/replay/run-recorder';
import { encodeCodec1 } from '../../src/replay/codec1';
import { MAX_INPUT_BYTES, replayRequest } from '../../src/replay/replay-request';

const SEED = 11;

/** A recorded level-1 run that ends in a game over, encoded as the game will send it. */
function recordedRun(): { inputs: string; frames: number; score: number } {
  const run = new Run({ seed: SEED });
  const recorder = new RunRecorder();
  const raw = createIntentFrame();
  const quantised = createIntentFrame();
  for (let i = 0; run.outcome() === RunOutcome.Playing; i += 1) {
    raw.held = Button.Fire;
    raw.pressed = i % 600 === 300 ? Button.Bomb : 0;
    raw.moveKind = 'target';
    raw.moveX = 120 + Math.sin(i / 29) * 90.3;
    raw.moveY = 260 + Math.cos(i / 47) * 30.1;
    quantizeIntent(raw, quantised);
    recorder.record(quantised);
    run.step(1 / 60, quantised);
  }
  return {
    inputs: encodeCodec1(recorder.records(), recorder.frames()),
    frames: recorder.frames(),
    score: run.snapshot().score,
  };
}

const RUN = recordedRun();

function request(fields: Record<string, unknown>): string {
  return JSON.stringify({
    seed: SEED,
    codec: 1,
    frames: RUN.frames,
    inputs: RUN.inputs,
    ...fields,
  });
}

describe('replayRequest', () => {
  it('replays a recorded run to its score', () => {
    expect(replayRequest(request({}))).toEqual({
      ok: true,
      score: RUN.score,
      outcome: 'game-over',
      framesRead: RUN.frames,
    });
  });

  it('fits a whole recorded run in the 60 000-character size guard', () => {
    expect(RUN.inputs.length).toBeLessThanOrEqual(60_000);
  });

  it.each([
    ['not JSON', '{'],
    ['not an object', '3'],
    ['null', 'null'],
    ['a negative seed', request({ seed: -1 })],
    ['a seed past 32 bits', request({ seed: 2 ** 32 })],
    ['another codec', request({ codec: 2 })],
    ['a fractional frame count', request({ frames: 1.5 })],
    ['no frame', request({ frames: 0 })],
    ['inputs that are not text', request({ inputs: 4 })],
    ['a frame count off the data', request({ frames: RUN.frames - 1 })],
  ])('answers decode for %s', (_label, text) => {
    expect(replayRequest(text)).toEqual({ ok: false, error: 'decode' });
  });

  it('answers overflow past the longest run, before decoding', () => {
    expect(replayRequest(request({ frames: MAX_RECORDED_STEPS + 1 }))).toEqual({
      ok: false,
      error: 'overflow',
    });
  });

  it('answers unfinished for a run cut before its end, and wrong seeds never match', () => {
    const cut = recordedPrefix(100);
    expect(replayRequest(request({ frames: 100, inputs: cut }))).toEqual({
      ok: false,
      error: 'unfinished',
    });
    expect(replayRequest(request({ seed: SEED + 1 }))).not.toEqual(replayRequest(request({})));
  });
});

function recordedPrefix(frames: number): string {
  const recorder = new RunRecorder();
  const frame = createIntentFrame();
  for (let i = 0; i < frames; i += 1) recorder.record(frame);
  return encodeCodec1(recorder.records(), frames);
}

describe('the replay CLI bundle', () => {
  // Built into a private folder, so concurrent runs never share `dist-replay/`.
  const outDir = mkdtempSync(join(tmpdir(), 'replay-cli-'));

  beforeAll(async () => {
    await build({ configFile: 'vite.replay.config.ts', logLevel: 'silent', build: { outDir } });
  }, 60_000);

  function cli(stdin: string): string {
    return execFileSync(process.execPath, [join(outDir, 'replay.mjs')], {
      input: stdin,
      encoding: 'utf8',
    });
  }

  it('writes one JSON line for a valid run and exits 0', () => {
    expect(cli(request({}))).toBe(
      `${JSON.stringify({ ok: true, score: RUN.score, outcome: 'game-over', framesRead: RUN.frames })}\n`,
    );
  });

  it('answers decode for junk and for more than 1 MiB, still exiting 0', () => {
    expect(cli('junk')).toBe('{"ok":false,"error":"decode"}\n');
    expect(cli(' '.repeat(MAX_INPUT_BYTES + 1))).toBe('{"ok":false,"error":"decode"}\n');
  });
});
