import { describe, expect, it } from 'vitest';
import { DeviceInput } from '../../src/adapters/input/device-input';
import type { InputEnvironment, KeyEventLike } from '../../src/adapters/input/device-input';
import { FrameLoop, STEP_MS } from '../../src/app/frame-loop';
import type { FrameTarget } from '../../src/app/frame-loop';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import { Button } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';

/** Captures the key listener only; focus is never lost here. */
class KeyOnlyEnvironment implements InputEnvironment {
  private keyDown: ((event: KeyEventLike) => void) | undefined;
  onKeyDown(listener: (event: KeyEventLike) => void): void {
    this.keyDown = listener;
  }
  onKeyUp(): void {
    // No release in this scenario.
  }
  onFocusLost(): void {
    // Focus is never lost in this scenario.
  }
  press(code: string): void {
    this.keyDown?.({
      code,
      repeat: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: () => undefined,
    });
  }
}

/** Records the `pressed` mask each step receives. */
class PressedPerStep implements FrameTarget {
  readonly pressed: number[] = [];
  timeScale(): number {
    return 1;
  }
  step(_dt: number, frame: Readonly<IntentFrame>): void {
    this.pressed.push(frame.pressed);
  }
  render(): void {
    // Nothing to draw.
  }
}

describe('DeviceInput through the FrameLoop (ADR-0009 decision 1)', () => {
  it('gives a press to exactly one step when a frame runs several', () => {
    const env = new KeyOnlyEnvironment();
    const input = new DeviceInput(env);
    input.setBindings(DEFAULT_BINDINGS);
    const target = new PressedPerStep();
    let now = 0;
    let pending: (() => void) | undefined;
    const loop = new FrameLoop({ now: () => now }, input, target, (callback) => {
      pending = callback;
    });
    loop.start();
    pending?.(); // first frame: time origin, no step

    env.press('Enter');
    now += 3 * STEP_MS;
    pending?.();

    expect(target.pressed).toEqual([Button.Confirm, 0, 0]);
  });
});
