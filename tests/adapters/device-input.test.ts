import { describe, expect, it } from 'vitest';
import { DeviceInput } from '../../src/adapters/input/device-input';
import type { InputEnvironment, KeyEventLike } from '../../src/adapters/input/device-input';
import type { GamepadList } from '../../src/adapters/input/gamepad';
import type { PointerEventLike } from '../../src/adapters/input/pointer';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import { LANDSCAPE, PORTRAIT } from '../../src/domain/presentation/screen';
import type { IntentFrame } from '../../src/domain/ports/input-port';

type Modifier = 'ctrl' | 'meta' | 'alt';

/** Stands for the browser: captures the listeners the adapter registers, then replays events. */
class FakeEnvironment implements InputEnvironment {
  private keyDown: ((event: KeyEventLike) => void) | undefined;
  private keyUp: ((event: KeyEventLike) => void) | undefined;
  private focusLost: (() => void) | undefined;
  private readonly pointer: Partial<
    Record<'down' | 'move' | 'up' | 'cancel', (event: PointerEventLike) => void>
  > = {};
  readonly prevented: string[] = [];

  onKeyDown(listener: (event: KeyEventLike) => void): void {
    this.keyDown = listener;
  }
  onKeyUp(listener: (event: KeyEventLike) => void): void {
    this.keyUp = listener;
  }
  onFocusLost(listener: () => void): void {
    this.focusLost = listener;
  }
  onPointerDown(listener: (event: PointerEventLike) => void): void {
    this.pointer.down = listener;
  }
  onPointerMove(listener: (event: PointerEventLike) => void): void {
    this.pointer.move = listener;
  }
  onPointerUp(listener: (event: PointerEventLike) => void): void {
    this.pointer.up = listener;
  }
  onPointerCancel(listener: (event: PointerEventLike) => void): void {
    this.pointer.cancel = listener;
  }
  /** The pads the next read polls; tests replace it. */
  pads: GamepadList = [];
  gamepads(): GamepadList {
    return this.pads;
  }

  /** A pointer event at CSS pixel (x, y); the tests' canvas maps 1 CSS pixel to 1 logical pixel. */
  point(
    kind: 'down' | 'move' | 'up' | 'cancel',
    pointerType: string,
    x: number,
    y: number,
    buttons = 0,
    pointerId = 1,
  ): void {
    this.pointer[kind]?.({ pointerId, pointerType, clientX: x, clientY: y, buttons });
  }

  down(code: string, repeat = false, modifier: Modifier | null = null): void {
    this.keyDown?.(this.event(code, repeat, modifier));
  }
  up(code: string): void {
    this.keyUp?.(this.event(code, false, null));
  }
  loseFocus(): void {
    this.focusLost?.();
  }

  private event(code: string, repeat: boolean, modifier: Modifier | null): KeyEventLike {
    return {
      code,
      repeat,
      ctrlKey: modifier === 'ctrl',
      metaKey: modifier === 'meta',
      altKey: modifier === 'alt',
      preventDefault: () => {
        this.prevented.push(code);
      },
    };
  }
}

function setup(): { env: FakeEnvironment; input: DeviceInput; frame: IntentFrame } {
  const env = new FakeEnvironment();
  const input = new DeviceInput(env);
  input.setBindings(DEFAULT_BINDINGS);
  return { env, input, frame: createIntentFrame() };
}

describe('DeviceInput — keyboard movement (ADR-0009, ADR-0015 decision 6)', () => {
  it('gives a unit direction from the arrows and from WASD', () => {
    const { env, input, frame } = setup();
    env.down('ArrowLeft');
    input.read(frame);
    expect([frame.moveKind, frame.moveX, frame.moveY]).toEqual(['direction', -1, 0]);
    env.up('ArrowLeft');
    env.down('KeyS');
    input.read(frame);
    expect([frame.moveX, frame.moveY]).toEqual([0, 1]);
  });

  it('normalizes diagonals so they are not faster', () => {
    const { env, input, frame } = setup();
    env.down('ArrowRight');
    env.down('ArrowUp');
    input.read(frame);
    expect(frame.moveX).toBeCloseTo(Math.SQRT1_2, 12);
    expect(frame.moveY).toBeCloseTo(-Math.SQRT1_2, 12);
  });

  it('cancels opposite directions held together', () => {
    const { env, input, frame } = setup();
    env.down('ArrowLeft');
    env.down('KeyD');
    input.read(frame);
    expect([frame.moveX, frame.moveY]).toEqual([0, 0]);
  });

  it('gives no movement when no direction key is held', () => {
    const { input, frame } = setup();
    input.read(frame);
    expect(frame.moveKind).toBe('none');
  });

  it('keeps moving while one of two keys of the same direction is still held', () => {
    const { env, input, frame } = setup();
    env.down('ArrowLeft');
    env.down('KeyA');
    env.up('ArrowLeft');
    input.read(frame);
    expect(frame.moveX).toBe(-1);
  });
});

describe('DeviceInput — buttons and press latching (ADR-0009 decision 1)', () => {
  it('holds Fire while its key is down', () => {
    const { env, input, frame } = setup();
    env.down('Space');
    input.read(frame);
    expect(frame.held & Button.Fire).toBe(Button.Fire);
    env.up('Space');
    input.read(frame);
    expect(frame.held & Button.Fire).toBe(0);
  });

  it('latches a press shorter than one step, then consumes it in exactly one read', () => {
    const { env, input, frame } = setup();
    env.down('KeyX');
    env.up('KeyX');
    input.read(frame);
    expect(frame.pressed).toBe(Button.Bomb);
    input.read(frame);
    expect(frame.pressed).toBe(0);
  });

  it('ignores an auto-repeat arriving after a lost focus: a still-held key is no new press', () => {
    const { env, input, frame } = setup();
    env.down('Space');
    env.loseFocus();
    input.read(frame);
    env.down('Space', true);
    input.read(frame);
    expect(frame.held).toBe(0);
    expect(frame.pressed).toBe(0);
  });

  it('does not count an auto-repeated keydown as a new press', () => {
    const { env, input, frame } = setup();
    env.down('KeyP');
    input.read(frame);
    env.down('KeyP', true);
    input.read(frame);
    expect(frame.pressed).toBe(0);
  });

  it.each([
    ['Enter', Button.Confirm],
    ['NumpadEnter', Button.Confirm],
    ['Escape', Button.Pause | Button.Back],
  ])('maps the fixed key %s', (code, buttons) => {
    const { env, input, frame } = setup();
    env.down(code);
    input.read(frame);
    expect(frame.pressed).toBe(buttons);
  });

  it('reports the keyboard as the device, with no tap', () => {
    const { env, input, frame } = setup();
    env.down('Space');
    input.read(frame);
    expect(frame.device).toBe('keyboard');
    expect(frame.tapRegion).toBe('none');
  });
});

describe('DeviceInput — lost focus (ADR-0015 decision 5)', () => {
  it('clears held keys, then sets Pause, so the ship never drifts or fires alone', () => {
    const { env, input, frame } = setup();
    env.down('ArrowLeft');
    env.down('Space');
    input.read(frame); // consumes the two real presses
    env.loseFocus();
    input.read(frame);
    expect(frame.moveKind).toBe('none');
    expect(frame.held).toBe(0);
    expect(frame.pressed).toBe(Button.Pause);
  });

  it('treats a key still held on return as a new press only when it goes down again', () => {
    const { env, input, frame } = setup();
    env.down('Space');
    input.read(frame);
    env.loseFocus();
    input.read(frame);
    expect(frame.held).toBe(0);
    env.down('Space');
    input.read(frame);
    expect(frame.held & Button.Fire).toBe(Button.Fire);
    expect(frame.pressed & Button.Fire).toBe(Button.Fire);
  });
});

describe('DeviceInput — browser defaults (ADR-0015 decisions 6 and 8)', () => {
  it('prevents the browser default for bound keys and Enter only, so arrows never scroll', () => {
    const { env } = setup();
    env.down('ArrowDown');
    env.down('Space');
    env.down('Enter');
    env.down('KeyQ');
    expect(env.prevented).toEqual(['ArrowDown', 'Space', 'Enter']);
  });

  it('keeps preventing the default on auto-repeat, so a held arrow never scrolls', () => {
    const { env } = setup();
    env.down('ArrowDown');
    env.down('ArrowDown', true);
    env.down('Space', true);
    expect(env.prevented).toEqual(['ArrowDown', 'ArrowDown', 'Space']);
  });

  it('never prevents Esc, held or repeated, so it can still leave fullscreen', () => {
    const { env } = setup();
    env.down('Escape');
    env.down('Escape', true);
    expect(env.prevented).toEqual([]);
  });
});

describe('DeviceInput — browser shortcuts (Ctrl, Cmd, Alt)', () => {
  it.each(['ctrl', 'meta', 'alt'] as const)(
    'ignores a bound key pressed with %s: no game input, browser action kept',
    (modifier) => {
      const { env, input, frame } = setup();
      env.down('KeyZ', false, modifier);
      input.read(frame);
      expect(frame.held).toBe(0);
      expect(frame.pressed).toBe(0);
      expect(env.prevented).toEqual([]);
    },
  );

  it('still treats Shift as a game key: left Shift is the secondary bomb', () => {
    const { env, input, frame } = setup();
    env.down('ShiftLeft');
    input.read(frame);
    expect(frame.pressed).toBe(Button.Bomb);
  });
});

describe('DeviceInput — touch and mouse through the façade (ADR-0018)', () => {
  const ONE_TO_ONE = { left: 0, top: 0, width: 480, height: 320 };

  function pointerSetup(): ReturnType<typeof setup> {
    const fixture = setup();
    fixture.input.resize(LANDSCAPE, ONE_TO_ONE);
    return fixture;
  }

  it('delivers a tap to one read, in its region coordinates', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'touch', 450, 20);
    input.read(frame);
    expect(frame).toMatchObject({ tapRegion: 'hud', tapX: 450, tapY: 20, device: 'touch' });
    input.read(frame);
    expect(frame.tapRegion).toBe('none');
  });

  it('steers with a finger and autofires while touch owns the movement', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'touch', 200, 250);
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'target', moveX: 80, moveY: 218, held: Button.Fire });
  });

  it('masks the touch autofire once a key moves the ship again', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'touch', 200, 250);
    env.point('up', 'touch', 200, 250);
    env.down('ArrowLeft');
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'direction', held: 0, device: 'keyboard' });
  });

  it('lets the mouse take the ship only by a move on the field', () => {
    const { env, input, frame } = pointerSetup();
    env.down('ArrowLeft');
    env.point('move', 'mouse', 30, 40);
    input.read(frame);
    expect(frame.moveKind).toBe('direction');
    env.point('move', 'mouse', 200, 250);
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'target', moveX: 80, moveY: 250, device: 'mouse' });
  });

  it('pauses once when the layout kind changes, never on the first resize or the same kind', () => {
    const { input, frame } = setup();
    input.resize(LANDSCAPE, ONE_TO_ONE);
    input.resize(LANDSCAPE, { left: 0, top: 0, width: 960, height: 640 });
    input.read(frame);
    expect(frame.pressed).toBe(0);
    input.resize(PORTRAIT, { left: 0, top: 0, width: 240, height: 352 });
    input.read(frame);
    expect(frame.pressed).toBe(Button.Pause);
    input.read(frame);
    expect(frame.pressed).toBe(0);
  });

  it('releases the steering finger and drops the tap when focus is lost', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'touch', 200, 250);
    env.loseFocus();
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'none', tapRegion: 'none', pressed: Button.Pause });
  });

  it('clears the mouse owner on lost focus: no movement, autofire masked', () => {
    const { env, input, frame } = pointerSetup();
    env.point('move', 'mouse', 200, 250);
    env.loseFocus();
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'none', held: 0, pressed: Button.Pause });
  });
});

describe('DeviceInput — gamepad through the façade (ADR-0015 decisions 5 and 7)', () => {
  /** A standard pad holding `held` buttons, stick centred. */
  function pad(held: readonly number[] = [], connected = true): GamepadList[number] {
    const buttons = [];
    for (let i = 0; i < 17; i += 1) buttons.push({ pressed: held.includes(i) });
    return { connected, mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
  }

  it('applies a gamepad start after the events of the same read', () => {
    const { env, input, frame } = setup();
    env.down('ArrowLeft');
    env.pads = [pad([15])];
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'direction', moveX: 1, device: 'gamepad' });
  });

  it('gives the movement back to a key that starts after the poll', () => {
    const { env, input, frame } = setup();
    env.pads = [pad([15])];
    input.read(frame);
    env.down('ArrowLeft');
    input.read(frame);
    expect(frame).toMatchObject({ moveX: -1, device: 'keyboard' });
  });

  it('pauses once when the active pad disconnects', () => {
    const { env, input, frame } = setup();
    env.pads = [pad([0])];
    input.read(frame);
    env.pads = [pad([], false)];
    input.read(frame);
    expect(frame.pressed).toBe(Button.Pause);
    input.read(frame);
    expect(frame.pressed).toBe(0);
  });

  it('keeps the previous poll over a lost focus: a button still held is no new press', () => {
    const { env, input, frame } = setup();
    env.pads = [pad([0])];
    input.read(frame);
    env.loseFocus();
    input.read(frame);
    expect(frame.pressed).toBe(Button.Pause);
    expect(frame.held).toBe(Button.Fire);
  });
});
