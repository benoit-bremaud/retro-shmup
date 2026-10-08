import { describe, expect, it } from 'vitest';
import { FrameLoop, MAX_FRAME_MS, STEP_MS } from '../../src/app/frame-loop';
import type { FrameTarget } from '../../src/app/frame-loop';
import { createIntentFrame } from '../../src/domain/ports/input-port';
import type { InputPort, IntentFrame } from '../../src/domain/ports/input-port';

class FakeClock {
  t = 0;
  now(): number {
    return this.t;
  }
}

class RecordingTarget implements FrameTarget {
  scale = 1;
  steps: number[] = [];
  renders: { alpha: number; wallDtMs: number }[] = [];
  timeScale(): number {
    return this.scale;
  }
  step(dtSeconds: number, _frame: Readonly<IntentFrame>): void {
    this.steps.push(dtSeconds);
  }
  render(alpha: number, wallDtMs: number): void {
    this.renders.push({ alpha, wallDtMs });
  }
}

class CountingInput implements InputPort {
  reads = 0;
  read(into: IntentFrame): void {
    this.reads += 1;
    into.held = 0;
  }
  setBindings(): void {
    /* not used by the loop */
  }
  captureNext(): { readonly kind: 'waiting' } {
    return { kind: 'waiting' };
  }
  label(code: string): string {
    return code;
  }
  setFullscreenWanted(): void {
    /* not used by the loop */
  }
}

function setup(): {
  clock: FakeClock;
  target: RecordingTarget;
  input: CountingInput;
  loop: FrameLoop;
  frames: () => void;
} {
  const clock = new FakeClock();
  const target = new RecordingTarget();
  const input = new CountingInput();
  let pending: (() => void) | undefined;
  const loop = new FrameLoop(clock, input, target, (callback) => {
    pending = callback;
  });
  return {
    clock,
    target,
    input,
    loop,
    frames: () => {
      const callback = pending;
      pending = undefined;
      callback?.();
    },
  };
}

describe('FrameLoop', () => {
  it('takes no step on the first frame, which only sets the time origin', () => {
    const { clock, target, loop, frames } = setup();
    clock.t = 1000;
    loop.start();
    frames();
    expect(target.steps).toEqual([]);
    expect(target.renders).toHaveLength(1);
  });

  it('runs one fixed step of 1/60 s for 1/60 s of wall time', () => {
    const { clock, target, loop, frames } = setup();
    loop.start();
    frames();
    clock.t += STEP_MS;
    frames();
    expect(target.steps).toEqual([1 / 60]);
  });

  it('runs whole steps only and carries the remainder to the next frame', () => {
    const { clock, target, loop, frames } = setup();
    loop.start();
    frames();
    clock.t += 2.5 * STEP_MS;
    frames();
    expect(target.steps).toHaveLength(2);
    clock.t += 0.5 * STEP_MS;
    frames();
    expect(target.steps).toHaveLength(3);
  });

  it('clamps a long frame to 250 ms, that is 15 steps (ADR-0002)', () => {
    const { clock, target, loop, frames } = setup();
    loop.start();
    frames();
    clock.t += 5000;
    frames();
    expect(MAX_FRAME_MS).toBe(250);
    expect(target.steps).toHaveLength(15);
  });

  it('reads the input once per step, never once per frame (ADR-0009)', () => {
    const { clock, input, loop, frames } = setup();
    loop.start();
    frames();
    clock.t += 3 * STEP_MS;
    frames();
    expect(input.reads).toBe(3);
  });

  it('takes no step while the time scale is 0 but keeps rendering with unscaled wall time', () => {
    const { clock, target, loop, frames } = setup();
    loop.start();
    frames();
    target.scale = 0;
    clock.t += 100;
    frames();
    expect(target.steps).toEqual([]);
    expect(target.renders.at(-1)?.wallDtMs).toBe(100);
  });

  it('slows the simulation down with a time scale below 1 (ADR-0010)', () => {
    const { clock, target, loop, frames } = setup();
    loop.start();
    frames();
    target.scale = 0.5;
    clock.t += 4 * STEP_MS;
    frames();
    expect(target.steps).toHaveLength(2);
  });

  it('passes the interpolation factor of the remaining accumulator to render', () => {
    const { clock, target, loop, frames } = setup();
    loop.start();
    frames();
    clock.t += 1.25 * STEP_MS;
    frames();
    expect(target.renders.at(-1)?.alpha).toBeCloseTo(0.25, 5);
  });

  it('stops scheduling frames once stopped', () => {
    const { clock, target, loop, frames } = setup();
    loop.start();
    frames();
    loop.stop();
    clock.t += STEP_MS;
    frames();
    expect(target.renders).toHaveLength(1);
  });

  it('hands the simulation one reused frame object, never a new one per step', () => {
    const { clock, target, loop, frames } = setup();
    const seen = new Set<object>();
    target.step = (_dt: number, frame: Readonly<IntentFrame>): void => {
      seen.add(frame);
    };
    loop.start();
    frames();
    clock.t += 3 * STEP_MS;
    frames();
    clock.t += 2 * STEP_MS;
    frames();
    expect(seen.size).toBe(1);
  });
});

describe('createIntentFrame', () => {
  it('starts with no movement, no button and no tap', () => {
    const frame = createIntentFrame();
    expect(frame.moveKind).toBe('none');
    expect(frame.held).toBe(0);
    expect(frame.pressed).toBe(0);
    expect(frame.tapRegion).toBe('none');
  });
});
