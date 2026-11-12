import { describe, expect, it } from 'vitest';
import { Run, RunOutcome } from '../../../src/domain/game/run';
import { Button, createIntentFrame } from '../../../src/domain/ports/input-port';
import {
  MAX_RECORDED_STEPS,
  RECORD_BYTES,
  quantizeIntent,
} from '../../../src/domain/replay/record';
import { replay } from '../../../src/domain/replay/replayer';
import { RunRecorder } from '../../../src/domain/replay/run-recorder';
import { STUB_BOSS, testScript } from '../../support/script';

const DT = 1 / 60;

/** Plays a scripted run to its end as the game does, recording every step. */
function playAndRecord(seed: number, limit: number): { recorder: RunRecorder; score: number } {
  const run = new Run({ seed });
  const recorder = new RunRecorder();
  const raw = createIntentFrame();
  const quantised = createIntentFrame();
  for (let i = 0; i < limit && run.outcome() === RunOutcome.Playing; i += 1) {
    raw.held = Button.Fire;
    raw.moveKind = 'direction';
    raw.moveX = Math.sin(i / 37) * 0.9;
    raw.moveY = Math.cos(i / 53) * 0.3;
    quantizeIntent(raw, quantised);
    recorder.record(quantised);
    run.step(DT, quantised);
  }
  return { recorder, score: run.snapshot().score };
}

describe('RunRecorder', () => {
  it('is empty and not sendable until a step is recorded', () => {
    const recorder = new RunRecorder();
    expect(recorder.frames()).toBe(0);
    expect(recorder.sendable()).toBe(false);
    recorder.record(createIntentFrame());
    expect(recorder.frames()).toBe(1);
    expect(recorder.records()).toHaveLength(RECORD_BYTES);
    expect(recorder.sendable()).toBe(true);
  });

  it('overflows past the longest run, and reset starts over', () => {
    const recorder = new RunRecorder();
    const empty = createIntentFrame();
    for (let i = 0; i <= MAX_RECORDED_STEPS; i += 1) recorder.record(empty);
    expect(recorder.frames()).toBe(MAX_RECORDED_STEPS);
    expect(recorder.sendable()).toBe(false);
    recorder.reset(9);
    expect(recorder.seed()).toBe(9);
    expect(recorder.frames()).toBe(0);
    recorder.record(empty);
    expect(recorder.sendable()).toBe(true);
  });
});

describe('replay', () => {
  const played = playAndRecord(7, MAX_RECORDED_STEPS);

  it('reaches the score and outcome of the recorded run', () => {
    const { recorder, score } = played;
    expect(replay(7, recorder.records(), recorder.frames())).toEqual({
      ok: true,
      score,
      outcome: 'game-over',
      framesRead: recorder.frames(),
    });
  });

  it('refuses records left after the outcome step', () => {
    const { recorder } = played;
    const longer = new Uint8Array(recorder.records().length + RECORD_BYTES);
    longer.set(recorder.records());
    expect(replay(7, longer, recorder.frames() + 1)).toEqual({
      ok: false,
      error: 'trailing-frames',
    });
  });

  it('refuses a run still playing after the last record', () => {
    const { recorder } = played;
    expect(replay(7, recorder.records().subarray(0, 10 * RECORD_BYTES), 10)).toEqual({
      ok: false,
      error: 'unfinished',
    });
  });

  it('refuses records that do not hold exactly the frame count', () => {
    expect(replay(7, new Uint8Array(0), 50)).toEqual({ ok: false, error: 'decode' });
    expect(replay(7, played.recorder.records(), played.recorder.frames() - 1)).toEqual({
      ok: false,
      error: 'decode',
    });
  });

  it('refuses an invalid record and an oversized run', () => {
    expect(replay(7, Uint8Array.from([0xf0, 0, 0, 0, 0]), 1)).toEqual({
      ok: false,
      error: 'decode',
    });
    expect(replay(7, new Uint8Array(0), MAX_RECORDED_STEPS + 1)).toEqual({
      ok: false,
      error: 'overflow',
    });
  });

  it('reports a cleared run', () => {
    const levels = [testScript([], { warningAt: 5, boss: { ...STUB_BOSS, timeLimit: 1 } })];
    const run = new Run({ seed: 1, levels });
    const recorder = new RunRecorder();
    const idle = createIntentFrame();
    while (run.outcome() === RunOutcome.Playing && recorder.frames() < 12000) {
      recorder.record(idle);
      run.step(DT, idle);
    }
    expect(run.outcome()).toBe(RunOutcome.RunCleared);
    expect(replay(1, recorder.records(), recorder.frames(), { levels })).toMatchObject({
      ok: true,
      outcome: 'run-cleared',
    });
  });
});
