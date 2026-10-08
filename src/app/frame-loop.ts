import type { Clock } from '../domain/ports/clock';
import { createIntentFrame } from '../domain/ports/input-port';
import type { InputPort, IntentFrame } from '../domain/ports/input-port';

/** One simulation step in wall-clock milliseconds; the domain receives seconds (ADR-0014). */
export const STEP_MS = 1000 / 60;
export const STEP_SECONDS = 1 / 60;
/** A single frame never advances the simulation by more than this (ADR-0002). */
export const MAX_FRAME_MS = 250;

// Tolerance for the floating-point remainder of repeated 1000 / 60 subtractions.
const EPSILON_MS = 1e-6;

/** What the loop drives: the scene machine in the game, a test double in tests. */
export interface FrameTarget {
  /**
   * Hit-stop and slow motion scale the wall time fed to the accumulator (ADR-0010). Expected in
   * [0, 1]; the loop clamps any other value, so a bad scale can neither freeze nor speed up the run.
   */
  timeScale(): number;
  step(dtSeconds: number, frame: Readonly<IntentFrame>): void;
  /** `wallDtMs` is unscaled: presentation effects run on wall-clock time (ADR-0010). */
  render(alpha: number, wallDtMs: number): void;
}

/** `requestAnimationFrame` in the browser; a manual trigger in tests. */
export type ScheduleFrame = (callback: () => void) => void;

/**
 * Fixed-timestep frame loop (ADR-0002, Fiedler's "Fix Your Timestep!"): wall time, clamped and
 * scaled, fills an accumulator that is drained in whole steps of 1/60 s; the remainder gives the
 * interpolation factor. The input is read once per step into one reused frame (ADR-0009).
 *
 * The accumulator starts half a step full: on a 60 Hz display the remainder then oscillates far
 * from the step threshold, so clock jitter never turns one step per frame into 0 or 2.
 */
export class FrameLoop {
  private readonly frame = createIntentFrame();
  private lastMs: number | undefined;
  private accumulatorMs = 0;
  private running = false;
  private scheduled = false;
  private readonly clock: Clock;
  private readonly input: InputPort;
  private readonly target: FrameTarget;
  private readonly schedule: ScheduleFrame;

  constructor(clock: Clock, input: InputPort, target: FrameTarget, schedule: ScheduleFrame) {
    this.clock = clock;
    this.input = input;
    this.target = target;
    this.schedule = schedule;
  }

  /** Starts, or restarts after `stop()`: the time origin is reset and the remainder discarded. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastMs = undefined;
    this.accumulatorMs = STEP_MS / 2;
    this.scheduleOnce();
  }

  stop(): void {
    this.running = false;
  }

  // At most one pending frame callback, whatever the start / stop sequence: a second chain would
  // render twice per frame forever.
  private scheduleOnce(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    this.schedule(this.onFrame);
  }

  private readonly onFrame = (): void => {
    this.scheduled = false;
    if (!this.running) return;
    this.tick(this.clock.now());
    // Unconditional: after a stop() during the tick, the next callback returns without rescheduling.
    this.scheduleOnce();
  };

  private tick(nowMs: number): void {
    const elapsed = this.lastMs === undefined ? 0 : nowMs - this.lastMs;
    const wallDtMs = Math.min(Math.max(elapsed, 0), MAX_FRAME_MS);
    this.lastMs = nowMs;
    const scale = this.target.timeScale();
    this.accumulatorMs += wallDtMs * (scale > 0 ? Math.min(scale, 1) : 0);
    while (this.accumulatorMs + EPSILON_MS >= STEP_MS) {
      this.input.read(this.frame);
      this.target.step(STEP_SECONDS, this.frame);
      this.accumulatorMs -= STEP_MS;
    }
    this.accumulatorMs = Math.max(this.accumulatorMs, 0);
    this.target.render(this.accumulatorMs / STEP_MS, wallDtMs);
  }
}
