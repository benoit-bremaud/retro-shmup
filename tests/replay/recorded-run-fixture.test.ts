import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import { MAX_RECORDED_STEPS, quantizeIntent } from '../../src/domain/replay/record';
import { replay } from '../../src/domain/replay/replayer';
import { RunRecorder } from '../../src/domain/replay/run-recorder';
import { decodeCodec1, encodeCodec1 } from '../../src/replay/codec1';

/**
 * The recorded run the browser smoke test replays in three engines (ADR-0031 decision 11). A
 * simulation change moves where the run ends: this test then fails here, under `just check`,
 * before the smoke does. Re-record it with `RECORD_FIXTURE=1 pnpm vitest run recorded-run-fixture`.
 */
const FIXTURE = 'tests/smoke/fixtures/recorded-run.json';
const SEED = 20261112;

/** Fire held, a slow figure-of-eight: the same script as the replayer tests, to the run's end. */
function record(): { frames: number; inputs: string } {
  const run = new Run({ seed: SEED });
  const recorder = new RunRecorder();
  const raw = createIntentFrame();
  const quantised = createIntentFrame();
  for (let i = 0; i < MAX_RECORDED_STEPS && run.outcome() === RunOutcome.Playing; i += 1) {
    raw.held = Button.Fire;
    raw.moveKind = 'direction';
    raw.moveX = Math.sin(i / 37) * 0.9;
    raw.moveY = Math.cos(i / 53) * 0.3;
    quantizeIntent(raw, quantised);
    recorder.record(quantised);
    run.step(1 / 60, quantised);
  }
  return { frames: recorder.frames(), inputs: encodeCodec1(recorder.records(), recorder.frames()) };
}

describe('the recorded-run fixture', () => {
  it('replays to a finished run in Node', () => {
    if (process.env.RECORD_FIXTURE === '1') {
      const { frames, inputs } = record();
      writeFileSync(
        FIXTURE,
        `${JSON.stringify({ seed: SEED, codec: 1, frames, inputs }, null, 2)}\n`,
      );
    }
    const fixture: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    const frames = Number(Reflect.get(Object(fixture), 'frames'));
    const decoded = decodeCodec1(String(Reflect.get(Object(fixture), 'inputs')), frames);
    expect(decoded.ok).toBe(true);
    const report = decoded.ok ? replay(SEED, decoded.records, frames) : undefined;
    expect(report).toMatchObject({ ok: true });
    expect(Reflect.get(Object(fixture), 'seed')).toBe(SEED);
  });
});
