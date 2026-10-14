import { describe, expect, it } from 'vitest';
import { bind, restore } from '../../src/domain/input/bindings-editor';
import { isCapturableButton, isCapturableKey } from '../../src/domain/input/capturable';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import type { Bindings } from '../../src/domain/ports/input-port';

describe('the capturable set (GDD v0.15 §4.2)', () => {
  it.each([
    'KeyA',
    'KeyZ',
    'Digit0',
    'Digit9',
    'ArrowUp',
    'Space',
    'ShiftLeft',
    'ControlRight',
    'AltLeft',
    'Backspace',
    'Numpad0',
    'Numpad9',
  ])('accepts %s', (code) => {
    expect(isCapturableKey(code)).toBe(true);
  });

  it.each([
    'Escape',
    'Enter',
    'NumpadEnter',
    'Tab',
    'F5',
    'F11',
    'MetaLeft',
    'ContextMenu',
    'Semicolon',
    'KeyAA',
    '',
    '__proto__',
  ])('refuses %s', (code) => {
    expect(isCapturableKey(code)).toBe(false);
  });

  it('accepts gamepad buttons 0 to 15 only', () => {
    expect(isCapturableButton(0)).toBe(true);
    expect(isCapturableButton(15)).toBe(true);
    expect(isCapturableButton(16)).toBe(false);
    expect(isCapturableButton(-1)).toBe(false);
    expect(isCapturableButton(1.5)).toBe(false);
  });
});

describe('bind — one slot, with the exchange (GDD v0.15 §4.2)', () => {
  it('puts a free key in the slot and leaves the rest unchanged', () => {
    const next = bind(DEFAULT_BINDINGS, 'keyboard', 'pause', 'secondary', 'KeyC');
    expect(next?.keyboard.pause).toEqual({ primary: 'KeyP', secondary: 'KeyC' });
    expect(next?.keyboard.fire).toEqual(DEFAULT_BINDINGS.keyboard.fire);
    expect(next?.gamepad).toBe(DEFAULT_BINDINGS.gamepad);
  });

  it('exchanges a key already bound elsewhere on the same device', () => {
    // X is bomb's primary; fire's primary Space goes to bomb.
    const next = bind(DEFAULT_BINDINGS, 'keyboard', 'fire', 'primary', 'KeyX');
    expect(next?.keyboard.fire).toEqual({ primary: 'KeyX', secondary: 'KeyZ' });
    expect(next?.keyboard.bomb).toEqual({ primary: 'Space', secondary: 'ShiftLeft' });
  });

  it('promotes the secondary when the exchange would empty a primary', () => {
    // Z (fire's secondary) moves into pause's empty secondary: fire's secondary becomes empty.
    const freed = bind(DEFAULT_BINDINGS, 'keyboard', 'pause', 'secondary', 'KeyZ');
    expect(freed?.keyboard.fire).toEqual({ primary: 'Space', secondary: null });
    // Space (fire's primary) moves into bomb's secondary: fire's primary takes bomb's old
    // secondary, ShiftLeft, never null.
    const swapped = freed && bind(freed, 'keyboard', 'bomb', 'secondary', 'Space');
    expect(swapped?.keyboard.fire).toEqual({ primary: 'ShiftLeft', secondary: null });
    expect(swapped?.keyboard.bomb).toEqual({ primary: 'KeyX', secondary: 'Space' });
  });

  it('promotes the other intent’s secondary when its primary would be left empty', () => {
    // Gamepad: bomb's secondary is empty; capturing A (fire's primary, fire has no secondary)
    // would leave fire without a button: refused.
    expect(bind(DEFAULT_BINDINGS, 'gamepad', 'bomb', 'secondary', 0)).toBeUndefined();
    // Keyboard: pause's secondary is empty; capturing Space (fire's primary) moves fire's
    // secondary Z up to primary.
    const next = bind(DEFAULT_BINDINGS, 'keyboard', 'pause', 'secondary', 'Space');
    expect(next?.keyboard.fire).toEqual({ primary: 'KeyZ', secondary: null });
    expect(next?.keyboard.pause).toEqual({ primary: 'KeyP', secondary: 'Space' });
  });

  it('handles a key moved within one intent', () => {
    // Pause's only key into its own empty secondary: it moves back up, nothing changes.
    expect(
      bind(DEFAULT_BINDINGS, 'keyboard', 'pause', 'secondary', 'KeyP')?.keyboard.pause,
    ).toEqual({ primary: 'KeyP', secondary: null });
    const fire = bind(DEFAULT_BINDINGS, 'keyboard', 'fire', 'secondary', 'Space');
    expect(fire?.keyboard.fire).toEqual({ primary: 'KeyZ', secondary: 'Space' });
  });

  it('refuses a button for the keyboard and a key for the gamepad', () => {
    expect(bind(DEFAULT_BINDINGS, 'keyboard', 'fire', 'secondary', 3)).toBeUndefined();
    expect(bind(DEFAULT_BINDINGS, 'gamepad', 'fire', 'secondary', 'KeyC')).toBeUndefined();
  });

  it('returns the same bindings when the slot already holds the input', () => {
    expect(bind(DEFAULT_BINDINGS, 'keyboard', 'fire', 'primary', 'Space')).toBe(DEFAULT_BINDINGS);
  });

  it('never binds an input twice on a device', () => {
    let bindings: Bindings | undefined = DEFAULT_BINDINGS;
    for (const [intent, code] of [
      ['moveUp', 'KeyX'],
      ['bomb', 'ArrowUp'],
      ['pause', 'KeyW'],
    ] as const) {
      bindings = bindings && bind(bindings, 'keyboard', intent, 'primary', code);
    }
    const codes = Object.values(bindings?.keyboard ?? {}).flatMap((slots) => [
      slots.primary,
      slots.secondary,
    ]);
    const bound = codes.filter((code) => code !== null);
    expect(new Set(bound).size).toBe(bound.length);
  });
});

describe('restore — one device (GDD v0.15 §4.2)', () => {
  it('resets the device edited only', () => {
    const changed = bind(DEFAULT_BINDINGS, 'gamepad', 'fire', 'secondary', 2);
    const keyboard = changed && bind(changed, 'keyboard', 'pause', 'secondary', 'KeyC');
    if (keyboard === undefined) throw new Error('setup failed');
    const restored = restore(keyboard, 'gamepad');
    expect(restored.gamepad).toEqual(DEFAULT_BINDINGS.gamepad);
    expect(restored.keyboard.pause.secondary).toBe('KeyC');
  });
});
