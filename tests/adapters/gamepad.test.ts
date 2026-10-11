import { describe, expect, it } from 'vitest';
import { createSample } from '../../src/adapters/input/arbitration';
import type { DeviceSample } from '../../src/adapters/input/arbitration';
import { GamepadModule } from '../../src/adapters/input/gamepad';
import type { GamepadLike } from '../../src/adapters/input/gamepad';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import { Button } from '../../src/domain/ports/input-port';
import type { Bindings } from '../../src/domain/ports/input-port';

// W3C standard mapping indices.
const A = 0;
const B = 1;
const START = 9;
const UP = 12;
const LEFT = 14;
const RIGHT = 15;

/** A standard pad holding `held` buttons with the left stick at (x, y). */
function pad(
  held: readonly number[] = [],
  x = 0,
  y = 0,
  extra: Partial<GamepadLike> = {},
): GamepadLike {
  const buttons = [];
  for (let i = 0; i < 17; i += 1) buttons.push({ pressed: held.includes(i) });
  return { connected: true, mapping: 'standard', buttons, axes: [x, y, 0, 0], ...extra };
}

function gamepad(bindings: Bindings = DEFAULT_BINDINGS): GamepadModule {
  const module = new GamepadModule();
  module.setBindings(bindings);
  return module;
}

function sampleOf(module: GamepadModule): DeviceSample {
  const sample = createSample();
  module.sample(sample);
  return sample;
}

describe('GamepadModule — buttons (GDD §4.2, ADR-0015 decision 7)', () => {
  it('holds the bound buttons and presses them once, by comparing with the previous poll', () => {
    const module = gamepad();
    module.poll([pad([A, B])], 1);
    expect(sampleOf(module)).toMatchObject({
      held: Button.Fire | Button.Bomb,
      pressed: Button.Fire | Button.Bomb | Button.Confirm | Button.Back,
      inputSeq: 1,
    });
    module.poll([pad([A, B])], 2);
    expect(sampleOf(module)).toMatchObject({
      held: Button.Fire | Button.Bomb,
      pressed: 0,
      inputSeq: 1,
    });
  });

  it('makes Start both Pause and Confirm', () => {
    const module = gamepad();
    module.poll([pad([START])], 1);
    expect(sampleOf(module).pressed).toBe(Button.Pause | Button.Confirm);
  });

  it('keeps the fixed roles on the indices after a remap (ADR-0018 decision 3)', () => {
    const swapped: Bindings = {
      ...DEFAULT_BINDINGS,
      gamepad: {
        ...DEFAULT_BINDINGS.gamepad,
        fire: { primary: B, secondary: null },
        bomb: { primary: A, secondary: null },
      },
    };
    const module = gamepad(swapped);
    module.poll([pad([A])], 1);
    expect(sampleOf(module).pressed).toBe(Button.Bomb | Button.Confirm);
  });

  it('reads only pads with the standard mapping', () => {
    const module = gamepad();
    module.poll([pad([A], 0, 0, { mapping: '' })], 1);
    expect(sampleOf(module)).toMatchObject({ held: 0, pressed: 0, inputSeq: 0 });
  });

  it('never reports the touch and mouse autofire', () => {
    const module = gamepad();
    module.poll([pad([A])], 1);
    expect(sampleOf(module).autofire).toBe(false);
  });
});

describe('GamepadModule — movement (ADR-0009, ADR-0018 decision 5)', () => {
  it('starts the movement when a d-pad direction goes down, normalized on diagonals', () => {
    const module = gamepad();
    module.poll([pad([UP, RIGHT])], 3);
    expect(sampleOf(module)).toMatchObject({
      moving: true,
      moveKind: 'direction',
      moveX: Math.SQRT1_2,
      moveY: -Math.SQRT1_2,
      startSeq: 3,
    });
  });

  it('cancels opposite d-pad directions', () => {
    const module = gamepad();
    module.poll([pad([LEFT, RIGHT])], 1);
    expect(sampleOf(module)).toMatchObject({ moveX: 0, moveY: 0, moving: false });
  });

  it('reads 0 inside the radial dead zone, and starts nothing', () => {
    const module = gamepad();
    module.poll([pad([], 0.15, 0.1)], 1);
    expect(sampleOf(module)).toMatchObject({ moving: false, moveX: 0, moveY: 0, startSeq: 0 });
  });

  it('rescales the stick from the dead zone edge, quantized to 1/256 toward zero', () => {
    const module = gamepad();
    module.poll([pad([], 0.6, 0)], 2);
    const sample = sampleOf(module);
    // (0.6 - 0.2) / 0.8 is 0.5 up to floating-point error; toward zero, within one step below it.
    expect(sample).toMatchObject({ moving: true, moveY: 0, startSeq: 2 });
    expect(sample.moveX).toBeGreaterThanOrEqual(0.5 - 1 / 256);
    expect(sample.moveX).toBeLessThanOrEqual(0.5);
    expect(sample.moveX * 256).toBe(Math.trunc(sample.moveX * 256));
  });

  it('never gives a length above 1, even at (0.6, 0.8)', () => {
    const module = gamepad();
    module.poll([pad([], 0.6, 0.8)], 1);
    const { moveX, moveY } = sampleOf(module);
    expect(Math.hypot(moveX, moveY)).toBeLessThanOrEqual(1);
    expect(moveX * 256).toBe(Math.trunc(moveX * 256));
    expect(moveY * 256).toBe(Math.trunc(moveY * 256));
  });

  it('clamps a stick reading beyond length 1, and never gives -0', () => {
    const module = gamepad();
    module.poll([pad([], -1, -1)], 1);
    const { moveX, moveY } = sampleOf(module);
    expect(Math.hypot(moveX, moveY)).toBeLessThanOrEqual(1);
    module.poll([pad([], -0.3, -0.000_1)], 2);
    expect(Object.is(sampleOf(module).moveY, -0)).toBe(false);
  });

  it('starts the movement when the stick leaves the dead zone, not while it stays out', () => {
    const module = gamepad();
    module.poll([pad([], 0.6, 0)], 1);
    module.poll([pad([], 0.9, 0)], 2);
    expect(sampleOf(module).startSeq).toBe(1);
    module.poll([pad([], 0, 0)], 3);
    expect(sampleOf(module).moving).toBe(false);
    module.poll([pad([], 0, 0.7)], 4);
    expect(sampleOf(module).startSeq).toBe(4);
  });

  it('lets the d-pad win over the stick', () => {
    const module = gamepad();
    module.poll([pad([LEFT], 0.9, 0)], 1);
    expect(sampleOf(module)).toMatchObject({ moveX: -1, moveY: 0 });
  });
});

describe('GamepadModule — active pad (GDD §4.2, ADR-0009 automatic pause)', () => {
  it('follows the last pad with input', () => {
    const module = gamepad();
    module.poll([pad([A]), pad()], 1);
    module.poll([pad([A]), pad([B])], 2);
    expect(sampleOf(module)).toMatchObject({ held: Button.Bomb, inputSeq: 2 });
  });

  it('makes a pad active again when its stick moves without recentring, with no new start', () => {
    const module = gamepad();
    module.poll([pad([], 0.6, 0), pad()], 1);
    module.poll([pad([], 0.6, 0), pad([A])], 2);
    module.poll([pad([], 0, 0.9), pad([A])], 3);
    expect(sampleOf(module)).toMatchObject({ held: 0, inputSeq: 3, startSeq: 1 });
    expect(sampleOf(module).moveY).toBeGreaterThan(0);
  });

  it('keeps a still stick from taking the pad back', () => {
    const module = gamepad();
    module.poll([pad([], 0.6, 0), pad()], 1);
    module.poll([pad([], 0.6, 0), pad([A])], 2);
    module.poll([pad([], 0.6, 0), pad([A])], 3);
    expect(sampleOf(module)).toMatchObject({ held: Button.Fire, inputSeq: 2 });
  });

  it('drops the press of a pad that is not active instead of delivering it later', () => {
    const module = gamepad();
    module.poll([pad([START]), pad([A])], 1);
    sampleOf(module);
    module.poll([pad([START]), pad([A])], 2);
    module.poll([pad([START, B]), pad([A])], 3);
    expect(sampleOf(module).pressed).toBe(Button.Bomb | Button.Back);
  });

  it.each([
    ['missing', null],
    ['disconnected', pad([], 0, 0, { connected: false })],
  ])('reports the loss once when the active pad goes %s', (_label, gone) => {
    const module = gamepad();
    module.poll([pad([A])], 1);
    expect(module.poll([gone], 2)).toBe(true);
    expect(sampleOf(module)).toMatchObject({ moving: false, held: 0, pressed: 0 });
    expect(module.poll([gone], 3)).toBe(false);
  });

  it('reports no loss for a pad that was never active', () => {
    const module = gamepad();
    module.poll([pad(), pad([A])], 1);
    expect(module.poll([null, pad([A])], 2)).toBe(false);
  });

  it('treats a button held across a reconnection as a new press', () => {
    const module = gamepad();
    module.poll([pad([A])], 1);
    module.poll([null], 2);
    module.poll([pad([A])], 3);
    expect(sampleOf(module).pressed).toBe(Button.Fire | Button.Confirm);
  });
});
