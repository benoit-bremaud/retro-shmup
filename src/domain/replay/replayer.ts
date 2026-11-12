import { Run, RunOutcome } from '../game/run';
import type { RunConfig } from '../game/run';
import { createIntentFrame } from '../ports/input-port';
import { MAX_RECORDED_STEPS, readRecord, validRecord } from './record';

const DT = 1 / 60;

/** How a replay ended: the score and outcome it reached, or why it is not a run (decision 22). */
export type ReplayReport =
  | {
      readonly ok: true;
      readonly score: number;
      readonly outcome: 'game-over' | 'run-cleared';
      readonly framesRead: number;
    }
  | {
      readonly ok: false;
      readonly error: 'decode' | 'trailing-frames' | 'unfinished' | 'overflow';
    };

/**
 * Plays `frames` records from `seed` through the real `Run`, as the game did: one record per step,
 * the run ending on the step whose outcome becomes `GAME_OVER` or `RUN_CLEARED` (decision 1).
 * Records left after that step are `trailing-frames`; a run still playing after the last record is
 * `unfinished`; an invalid record is `decode`. `config` is for tests only: the game and the CLI
 * replay the real level list.
 */
export function replay(
  seed: number,
  records: Uint8Array,
  frames: number,
  config: Omit<RunConfig, 'seed'> = {},
): ReplayReport {
  if (frames > MAX_RECORDED_STEPS) return { ok: false, error: 'overflow' };
  const run = new Run({ ...config, seed });
  const frame = createIntentFrame();
  for (let i = 0; i < frames; i += 1) {
    if (!validRecord(records, i)) return { ok: false, error: 'decode' };
    readRecord(records, i, frame);
    run.step(DT, frame);
    const outcome = run.outcome();
    if (outcome === RunOutcome.GameOver || outcome === RunOutcome.RunCleared) {
      if (i + 1 < frames) return { ok: false, error: 'trailing-frames' };
      return {
        ok: true,
        score: run.snapshot().score,
        outcome: outcome === RunOutcome.GameOver ? 'game-over' : 'run-cleared',
        framesRead: frames,
      };
    }
  }
  return { ok: false, error: 'unfinished' };
}
