import type { IntentFrame } from '../ports/input-port';
import { MAX_RECORDED_STEPS, RECORD_BYTES, writeRecord } from './record';

/**
 * Records one quantised frame per `Run.step` into one buffer allocated once and reused by every
 * run (ADR-0031 decision 4): no allocation in the loop. A run longer than `MAX_RECORDED_STEPS`
 * is overflowed and never sendable.
 */
export class RunRecorder {
  private readonly buffer = new Uint8Array(MAX_RECORDED_STEPS * RECORD_BYTES);
  private count = 0;
  private overflowed = false;
  private runSeed = 0;

  /** Starts the recording of a new run built from `seed`. */
  reset(seed: number): void {
    this.runSeed = seed;
    this.count = 0;
    this.overflowed = false;
  }

  /** Appends the quantised frame the simulation is about to read. */
  record(quantised: Readonly<IntentFrame>): void {
    if (this.count >= MAX_RECORDED_STEPS) {
      this.overflowed = true;
      return;
    }
    writeRecord(this.buffer, this.count, quantised);
    this.count += 1;
  }

  /** The seed of the recorded run, sent with its records. */
  seed(): number {
    return this.runSeed;
  }

  /** Records written in this run. */
  frames(): number {
    return this.count;
  }

  /**
   * Whether the recording itself can be sent: at least one record and no overflow. The caller
   * still checks the outcome: a run quit from the pause is never sent (ADR-0031 decisions 1, 13).
   */
  sendable(): boolean {
    return this.count > 0 && !this.overflowed;
  }

  /** The run's records: a view of the buffer, valid until the next `reset`. */
  records(): Uint8Array {
    return this.buffer.subarray(0, this.count * RECORD_BYTES);
  }
}
