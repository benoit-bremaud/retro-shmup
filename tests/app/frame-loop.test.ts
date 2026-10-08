import { describe, expect, it } from 'vitest';
import { FrameLoop, MAX_FRAME_MS, STEP_MS } from '../../src/app/frame-loop';
import type { FrameTarget } from '../../src/app/frame-loop';
import type { BindingCapture, InputPort, IntentFrame } from '../../src/domain/ports/input-port';

class FakeClock {
  t = 0;
  now(): number {
    return this.t;
  }
}

class RecordingTarget implements FrameTarget {
  scale = 1;
  steps: number[] = [];
  heldPerStep: number[] = [];
  frames = new Set<object>();
  renders: { alpha: number; wallDtMs: number }[] = [];
  onStep: (() => void) | undefined;
  timeScale(): number {
    return this.scale;
  }
  step(dtSeconds: number, frame: Readonly<IntentFrame>): void {
    this.steps.push(dtSeconds);
    this.heldPerStep.push(frame.held);
    this.frames.add(frame);
    this.onStep?.();
  }
  render(alpha: number, wallDtMs: number): void {
    this.renders.push({ alpha, wallDtMs });
  }
}

/** Numbers each read in `held`, so a test can check the read / step pairing. */
class CountingInput implements InputPort {
  reads = 0;
  read(into: IntentFrame): void {
    this.reads += 1;
    into.held = this.reads;
  }
  setBindings(): void {
    // Not used by the loop.
  }
  captureNext(): BindingCapture {
    return { kind: 'waiting' };
  }
  label(code: string): string {
    return code;
  }
  setFullscreenWanted(): void {
    // Not used by the loop.
  }
}

/** Behaves like requestAnimationFrame: callbacks queue up and all run on the next frame. */
class FrameScheduler {
  private queue: (() => void)[] = [];
  readonly schedule = (callback: () => void): void => {
    this.queue.push(callback);
  };
  get pending(): number {
    return this.queue.length;
  }
  runFrame(): void {
    const due = this.queue;
    this.queue = [];
    for (const callback of due) callback();
  }
}

function setup(): {
  clock: FakeClock;
  target: RecordingTarget;
  input: CountingInput;
  scheduler: FrameScheduler;
  loop: FrameLoop;
} {
  const clock = new FakeClock();
  const target = new RecordingTarget();
  const input = new CountingInput();
  const scheduler = new FrameScheduler();
  const loop = new FrameLoop(clock, input, target, scheduler.schedule);
  return { clock, target, input, scheduler, loop };
}

/** Starts the loop and runs the first frame, which only sets the time origin. */
function started(): ReturnType<typeof setup> {
  const fixture = setup();
  fixture.loop.start();
  fixture.scheduler.runFrame();
  return fixture;
}

function advance(fixture: ReturnType<typeof setup>, ms: number): void {
  fixture.clock.t += ms;
  fixture.scheduler.runFrame();
}

describe('FrameLoop — fixed steps (ADR-0002)', () => {
  it('takes no step on the first frame, which only sets the time origin', () => {
    const { target } = started();
    expect(target.steps).toEqual([]);
    expect(target.renders).toEqual([{ alpha: 0.5, wallDtMs: 0 }]);
  });

  it('runs one fixed step of 1/60 s for 1/60 s of wall time', () => {
    const fixture = started();
    advance(fixture, STEP_MS);
    expect(fixture.target.steps).toEqual([1 / 60]);
  });

  it('carries the remainder of a frame to the next one', () => {
    const fixture = started();
    advance(fixture, 1.25 * STEP_MS);
    expect(fixture.target.steps).toHaveLength(1);
    advance(fixture, 0.25 * STEP_MS);
    expect(fixture.target.steps).toHaveLength(2);
  });

  it('passes the interpolation factor of the remainder to render', () => {
    const fixture = started();
    advance(fixture, 1.25 * STEP_MS);
    expect(fixture.target.renders.at(-1)?.alpha).toBeCloseTo(0.75, 9);
  });

  it('clamps a long frame to 250 ms, that is 15 steps, and renders with the clamped time', () => {
    const fixture = started();
    advance(fixture, 5000);
    expect(fixture.target.steps).toHaveLength(15);
    expect(fixture.target.renders.at(-1)?.wallDtMs).toBe(MAX_FRAME_MS);
  });

  it('ignores a clock that goes backwards', () => {
    const fixture = started();
    advance(fixture, -40);
    expect(fixture.target.steps).toEqual([]);
    expect(fixture.target.renders.at(-1)?.wallDtMs).toBe(0);
  });

  it('gives exactly one step per frame on a 60 Hz display with a jittery 0.1 ms clock', () => {
    const { target, clock, scheduler, loop } = setup();
    loop.start();
    let jitter = 0.3;
    const stepsPerFrame = new Set<number>();
    for (let frame = 0; frame <= 10_000; frame += 1) {
      jitter = -jitter;
      clock.t = Math.round((frame * STEP_MS + jitter) * 10) / 10;
      const before = target.steps.length;
      scheduler.runFrame();
      if (frame > 0) stepsPerFrame.add(target.steps.length - before);
    }
    expect([...stepsPerFrame]).toEqual([1]);
  });

  it.each([30, 60, 120, 144, 165])(
    'runs 60 steps per second and keeps alpha in [0, 1) at %i Hz',
    (hz) => {
      const fixture = started();
      for (let frame = 0; frame < hz; frame += 1) advance(fixture, 1000 / hz);
      expect(Math.abs(fixture.target.steps.length - 60)).toBeLessThanOrEqual(1);
      for (const { alpha } of fixture.target.renders) {
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThan(1);
      }
    },
  );
});

describe('FrameLoop — input (ADR-0009)', () => {
  it('reads the input once per step, right before that step', () => {
    const fixture = started();
    advance(fixture, 3 * STEP_MS);
    expect(fixture.input.reads).toBe(3);
    expect(fixture.target.heldPerStep).toEqual([1, 2, 3]);
  });

  it('hands the simulation one reused frame object, never a new one per step', () => {
    const fixture = started();
    advance(fixture, 3 * STEP_MS);
    advance(fixture, 2 * STEP_MS);
    expect(fixture.target.frames.size).toBe(1);
  });
});

describe('FrameLoop — time scale (ADR-0010)', () => {
  it('takes no step while the scale is 0 but keeps rendering with unscaled wall time', () => {
    const fixture = started();
    fixture.target.scale = 0;
    advance(fixture, 100);
    expect(fixture.target.steps).toEqual([]);
    expect(fixture.target.renders.at(-1)?.wallDtMs).toBe(100);
  });

  it('slows the simulation down with a scale below 1', () => {
    const fixture = started();
    fixture.target.scale = 0.5;
    advance(fixture, 4 * STEP_MS);
    expect(fixture.target.steps).toHaveLength(2);
  });

  it('keeps the remainder through a hit-stop and resumes from it', () => {
    const fixture = started();
    advance(fixture, 1.25 * STEP_MS);
    fixture.target.scale = 0;
    advance(fixture, 100);
    expect(fixture.target.renders.at(-1)?.alpha).toBeCloseTo(0.75, 9);
    fixture.target.scale = 1;
    advance(fixture, 0.25 * STEP_MS);
    expect(fixture.target.steps).toHaveLength(2);
  });

  it.each([Number.NaN, -1])('treats an invalid scale (%s) as 0', (scale) => {
    const fixture = started();
    fixture.target.scale = scale;
    advance(fixture, 100);
    expect(fixture.target.steps).toEqual([]);
  });

  it('never runs faster than real time: a scale above 1 counts as 1', () => {
    const fixture = started();
    fixture.target.scale = 3;
    advance(fixture, MAX_FRAME_MS);
    expect(fixture.target.steps).toHaveLength(15);
  });
});

describe('FrameLoop — lifecycle', () => {
  it('stops rendering once stopped', () => {
    const fixture = started();
    fixture.loop.stop();
    advance(fixture, STEP_MS);
    expect(fixture.target.renders).toHaveLength(1);
  });

  it('keeps a single frame chain when started twice', () => {
    const fixture = setup();
    fixture.loop.start();
    fixture.loop.start();
    expect(fixture.scheduler.pending).toBe(1);
  });

  it('keeps a single frame chain after stop then start within one frame', () => {
    const fixture = started();
    fixture.loop.stop();
    fixture.loop.start();
    expect(fixture.scheduler.pending).toBe(1);
    advance(fixture, STEP_MS);
    advance(fixture, STEP_MS);
    expect(fixture.target.renders).toHaveLength(3);
  });

  it('keeps a single frame chain after stop then start inside a step', () => {
    const fixture = started();
    let restarted = false;
    fixture.target.onStep = () => {
      if (restarted) return;
      restarted = true;
      fixture.loop.stop();
      fixture.loop.start();
    };
    advance(fixture, STEP_MS);
    expect(fixture.scheduler.pending).toBe(1);
  });
});
