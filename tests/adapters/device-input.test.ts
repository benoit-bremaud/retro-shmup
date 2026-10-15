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
  /** The browser's fullscreen state and the calls the adapter made. */
  fullscreenActive = false;
  readonly fullscreenCalls: string[] = [];
  readonly fullscreen = {
    active: (): boolean => this.fullscreenActive,
    request: (): void => {
      this.fullscreenCalls.push('request');
    },
    exit: (): void => {
      this.fullscreenCalls.push('exit');
    },
  };
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

  down(code: string, repeat = false, modifier: Modifier | null = null, key = ''): void {
    this.keyDown?.(this.event(code, repeat, modifier, key));
  }
  /** A key down that prints `key`, as the player's layout makes it. */
  type(code: string, key: string): void {
    this.down(code, false, null, key);
  }
  /** The browser's layout map, when it has one; tests set it. */
  layout: ReadonlyMap<string, string> | undefined;
  layoutMap(): Promise<ReadonlyMap<string, string>> | undefined {
    return this.layout === undefined ? undefined : Promise.resolve(this.layout);
  }
  up(code: string): void {
    this.keyUp?.(this.event(code, false, null, ''));
  }
  loseFocus(): void {
    this.focusLost?.();
  }

  private event(
    code: string,
    repeat: boolean,
    modifier: Modifier | null,
    key: string,
  ): KeyEventLike {
    return {
      code,
      key,
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

/** A standard pad holding `held` buttons, stick centred. */
function pad(held: readonly number[] = [], connected = true): GamepadList[number] {
  const buttons = [];
  for (let i = 0; i < 17; i += 1) buttons.push({ pressed: held.includes(i) });
  return { connected, mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
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

  it('steers with a finger and fires while it steers (ADR-0020)', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'touch', 200, 250);
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'target', moveX: 80, moveY: 218, held: Button.Fire });
  });

  it('stops firing when the finger lifts, and a key takes the movement back', () => {
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

  it('clears the mouse owner on lost focus: no movement, no fire', () => {
    const { env, input, frame } = pointerSetup();
    env.point('move', 'mouse', 200, 250);
    env.loseFocus();
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'none', held: 0, pressed: Button.Pause });
  });
});

describe('DeviceInput — gamepad through the façade (ADR-0015 decisions 5 and 7)', () => {
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

  it('reads no pad when the browser refuses them, and keeps the other devices playing', () => {
    const { env, input, frame } = setup();
    env.gamepads = () => {
      throw new Error('SecurityError: gamepad is not allowed');
    };
    env.down('ArrowLeft');
    expect(() => {
      input.read(frame);
    }).not.toThrow();
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

describe('DeviceInput — held pointer fire (ADR-0020)', () => {
  function pointerSetup(): ReturnType<typeof setup> {
    const fixture = setup();
    fixture.input.resize(LANDSCAPE, { left: 0, top: 0, width: 480, height: 320 });
    return fixture;
  }

  it('fires from a held left button while the keyboard owns the movement (ADR-0020)', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'mouse', 200, 250, 1);
    env.down('ArrowLeft');
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'direction', held: Button.Fire });
  });

  it('needs a fresh press after a lost focus, even with the left button still held', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'mouse', 200, 250, 1);
    env.loseFocus();
    env.point('move', 'mouse', 201, 250, 1);
    input.read(frame);
    expect(frame.held & Button.Fire).toBe(0);
    expect(frame.tapRegion).toBe('none');
  });
});

describe('DeviceInput — options and menus (GDD v0.14 §9.1, ADR-0020 decision 4, ADR-0009)', () => {
  const ONE_TO_ONE = { left: 0, top: 0, width: 480, height: 320 };

  function pointerSetup(): ReturnType<typeof setup> {
    const fixture = setup();
    fixture.input.resize(LANDSCAPE, ONE_TO_ONE);
    return fixture;
  }

  it('releaseMovement drops a mouse owner, which takes the ship back by its next move', () => {
    const { env, input, frame } = pointerSetup();
    env.point('down', 'mouse', 200, 250, 1);
    env.point('up', 'mouse', 200, 250, 0);
    input.read(frame);
    expect(frame.moveKind).toBe('target');
    input.releaseMovement();
    input.read(frame);
    expect(frame.moveKind).toBe('none');
    env.point('move', 'mouse', 210, 250);
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'target', moveX: 90 });
  });

  it('releaseMovement keeps a keyboard owner, its held direction, and adds no pause', () => {
    const { env, input, frame } = pointerSetup();
    env.down('ArrowLeft');
    input.read(frame);
    input.releaseMovement();
    input.read(frame);
    expect(frame).toMatchObject({ moveKind: 'direction', moveX: -1, pressed: 0 });
  });

  it('setAutofire makes touch and mouse hold Fire while they own the movement', () => {
    const { env, input, frame } = pointerSetup();
    input.setAutofire(true);
    env.point('move', 'mouse', 200, 250);
    input.read(frame);
    expect(frame.held & Button.Fire).toBe(Button.Fire);
    input.setAutofire(false);
    input.read(frame);
    expect(frame.held & Button.Fire).toBe(0);
  });

  it('keeps a held mouse button firing with autofire on once the keyboard takes the ship', () => {
    const { env, input, frame } = pointerSetup();
    input.setAutofire(true);
    env.point('down', 'mouse', 200, 250, 1); // the button stays down
    env.down('ArrowLeft'); // the keyboard takes the ship back
    input.read(frame);
    expect(frame.moveKind).toBe('direction');
    expect(frame.held & Button.Fire).toBe(Button.Fire);
    env.point('up', 'mouse', 200, 250, 0);
    input.read(frame);
    expect(frame.held & Button.Fire).toBe(0); // the option alone, masked while the keyboard steers
  });

  it('applies a fullscreen change at the next key or pointer press, once', () => {
    const { env, input, frame } = pointerSetup();
    input.setFullscreenWanted(true);
    expect(env.fullscreenCalls).toEqual([]);
    env.down('KeyP');
    expect(env.fullscreenCalls).toEqual(['request']);
    env.fullscreenActive = true;
    input.read(frame);
    expect(frame.fullscreen).toBe(true);
    // The player left fullscreen with Esc: the wish is not applied again by itself.
    env.fullscreenActive = false;
    env.point('down', 'mouse', 200, 250, 1);
    expect(env.fullscreenCalls).toEqual(['request']);
    input.setFullscreenWanted(false);
    env.down('KeyP');
    expect(env.fullscreenCalls).toEqual(['request']); // already out: nothing to exit
  });

  it('exits fullscreen at the next gesture when it is turned off', () => {
    const { env, input } = pointerSetup();
    env.fullscreenActive = true;
    input.setFullscreenWanted(false);
    env.point('down', 'touch', 200, 250);
    expect(env.fullscreenCalls).toEqual(['exit']);
  });
});

describe('DeviceInput — capturing a new binding (GDD v0.15 §4.2, SD-remap)', () => {
  const ONE_TO_ONE = { left: 0, top: 0, width: 480, height: 320 };

  function waitingFor(device: 'keyboard' | 'gamepad'): ReturnType<typeof setup> {
    const fixture = setup();
    fixture.input.resize(LANDSCAPE, ONE_TO_ONE);
    fixture.input.startCapture(device);
    return fixture;
  }

  it('waits, then answers the next capturable key of the keyboard', () => {
    const { env, input } = waitingFor('keyboard');
    expect(input.captureNext()).toEqual({ kind: 'waiting' });
    env.type('KeyC', 'c');
    expect(input.captureNext()).toEqual({ kind: 'key', code: 'KeyC' });
    expect(input.captureNext()).toEqual({ kind: 'cancelled' }); // nothing pending any more
  });

  it.each(['Tab', 'F5', 'Enter', 'NumpadEnter', 'MetaLeft'])(
    'refuses %s and keeps waiting',
    (code) => {
      const { env, input } = waitingFor('keyboard');
      env.down(code);
      expect(input.captureNext()).toEqual({ kind: 'waiting' });
    },
  );

  it('cancels on Escape, whose browser action is kept', () => {
    const { env, input } = waitingFor('keyboard');
    env.down('Escape');
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
    expect(env.prevented).not.toContain('Escape');
  });

  it('prevents every other key\u2019s browser action while waiting', () => {
    const { env } = waitingFor('keyboard');
    env.down('Tab');
    env.down('KeyQ');
    expect(env.prevented).toEqual(['Tab', 'KeyQ']);
  });

  it('answers only the device it waits for', () => {
    const { env, input } = waitingFor('gamepad');
    env.type('KeyC', 'c');
    expect(input.captureNext()).toEqual({ kind: 'waiting' });
  });

  it('answers the next button pressed on a gamepad, and refuses button 16', () => {
    const { env, input, frame } = waitingFor('gamepad');
    env.pads = [pad([16])];
    input.read(frame);
    expect(input.captureNext()).toEqual({ kind: 'waiting' });
    env.pads = [pad([16, 3])];
    input.read(frame);
    expect(input.captureNext()).toEqual({ kind: 'button', index: 3 });
  });

  it('ignores a button already held when the capture starts', () => {
    const fixture = setup();
    fixture.env.pads = [pad([0])];
    fixture.input.read(fixture.frame);
    fixture.input.startCapture('gamepad');
    fixture.input.read(fixture.frame);
    expect(fixture.input.captureNext()).toEqual({ kind: 'waiting' });
  });

  it('cancels a gamepad wait after 5 s of reads', () => {
    const { env, input, frame } = waitingFor('gamepad');
    env.pads = [pad()];
    for (let i = 0; i < 299; i += 1) input.read(frame);
    expect(input.captureNext()).toEqual({ kind: 'waiting' });
    input.read(frame);
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
  });

  it.each([
    ['ControlLeft', 'ctrl'],
    ['AltLeft', 'alt'],
  ] as const)('captures %s, sent with its own modifier flag as browsers do', (code, flag) => {
    const { env, input } = waitingFor('keyboard');
    env.down(code, false, flag);
    expect(input.captureNext()).toEqual({ kind: 'key', code });
  });

  it('still ignores a shortcut: a letter with Ctrl held', () => {
    const { env, input } = waitingFor('keyboard');
    env.down('KeyC', false, 'ctrl');
    expect(input.captureNext()).toEqual({ kind: 'waiting' });
  });

  it('latches no intent with the key that answers, nor with Escape', () => {
    const { env, input, frame } = waitingFor('keyboard');
    env.down('Space'); // bound to fire
    input.read(frame);
    expect(frame.pressed).toBe(0);
    expect(input.captureNext()).toEqual({ kind: 'key', code: 'Space' });
    input.startCapture('keyboard');
    env.down('Escape');
    input.read(frame);
    expect(frame.pressed).toBe(0);
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
  });

  it('cancels a gamepad wait when the active pad is lost', () => {
    const fixture = setup();
    fixture.env.pads = [pad([0])];
    fixture.input.read(fixture.frame); // the pad becomes active
    fixture.input.startCapture('gamepad');
    fixture.env.pads = [];
    fixture.input.read(fixture.frame);
    expect(fixture.input.captureNext()).toEqual({ kind: 'cancelled' });
  });

  it('times out a gamepad wait with no pad at all', () => {
    const { input, frame } = waitingFor('gamepad');
    for (let i = 0; i < 300; i += 1) input.read(frame);
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
  });

  it('keeps an answer already given when a cancel comes in the same step', () => {
    const { env, input } = waitingFor('keyboard');
    env.type('KeyC', 'c');
    input.cancelCapture();
    expect(input.captureNext()).toEqual({ kind: 'key', code: 'KeyC' });
  });

  it('answers once: the poll after an answer finds no capture', () => {
    const { env, input } = waitingFor('keyboard');
    env.type('KeyC', 'c');
    input.captureNext();
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
  });

  it('cancels on a lost focus and on cancelCapture', () => {
    const { env, input } = waitingFor('keyboard');
    env.loseFocus();
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
    input.startCapture('keyboard');
    input.cancelCapture();
    env.type('KeyC', 'c');
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
  });
});

describe('DeviceInput — key labels (GDD v0.15 §4.2)', () => {
  it('gives the US character of a letter or digit key before any press', () => {
    const { input } = setup();
    expect(input.label('KeyQ')).toBe('Q');
    expect(input.label('Digit7')).toBe('7');
  });

  it('learns the character the layout prints from the key events', () => {
    const { env, input } = setup();
    env.type('KeyQ', 'a'); // AZERTY: the US Q position prints A
    expect(input.label('KeyQ')).toBe('A');
  });

  it('keeps the US character when the printed one cannot be drawn', () => {
    const { env, input } = setup();
    env.type('Digit2', '\u00e9'); // AZERTY: the 2 key prints é
    expect(input.label('Digit2')).toBe('2');
  });

  it('uses the browser layout map until a key event teaches better', async () => {
    const env = new FakeEnvironment();
    env.layout = new Map([['KeyW', 'z']]);
    const input = new DeviceInput(env);
    await new Promise((resolve) => setTimeout(resolve, 0)); // the map resolves asynchronously
    expect(input.label('KeyW')).toBe('Z');
    env.type('KeyW', 'w');
    expect(input.label('KeyW')).toBe('W');
  });

  it('keeps a learned character when the same key later prints one the font cannot draw', () => {
    const { env, input } = setup();
    env.type('KeyE', 'e');
    env.type('KeyE', '\u20ac'); // AltGr+E prints €
    expect(input.label('KeyE')).toBe('E');
  });

  it('gives no character for a key that has none to show', () => {
    const { input } = setup();
    expect(input.label('Space')).toBe('');
    expect(input.label('ArrowUp')).toBe('');
    expect(input.label('Numpad1')).toBe('');
  });
});

describe('DeviceInput — the raw activity signal (ADR-0009 amended, GDD v0.16 §9.1)', () => {
  it('is quiet when nothing happens', () => {
    const { input, frame } = setup();
    input.read(frame);
    expect(frame.active).toBe(false);
  });

  it('sees any key, bound or not, and a key held until it is released', () => {
    const { env, input, frame } = setup();
    env.down('KeyQ'); // not bound by default
    input.read(frame);
    expect(frame.active).toBe(true);
    input.read(frame); // still down, no new event
    expect(frame.active).toBe(true);
    env.up('KeyQ');
    input.read(frame);
    expect(frame.active).toBe(false);
  });

  it('sees a held Enter, a fixed key, for as long as it is down', () => {
    const { env, input, frame } = setup();
    env.down('Enter');
    input.read(frame);
    input.read(frame);
    expect(frame.active).toBe(true);
  });

  it('sees a browser shortcut too: it is the player touching the keyboard', () => {
    const { env, input, frame } = setup();
    env.down('KeyR', false, 'ctrl');
    input.read(frame);
    expect(frame.active).toBe(true);
  });

  it('sees a held shortcut key, Meta included, without auto-repeat, until it is released', () => {
    const { env, input, frame } = setup();
    env.down('MetaLeft', false, 'meta');
    input.read(frame);
    input.read(frame); // no repeat event: still held
    expect(frame.active).toBe(true);
    expect(frame.pressed).toBe(0); // a shortcut is never a game input
    env.up('MetaLeft');
    input.read(frame);
    expect(frame.active).toBe(false);
  });

  it('forgets a held shortcut key on focus loss', () => {
    const { env, input, frame } = setup();
    env.down('KeyR', false, 'ctrl');
    env.loseFocus();
    input.read(frame); // the keydown of this read still counts
    input.read(frame);
    expect(frame.active).toBe(false);
  });

  it('sees a pointer moving anywhere on the page, the side bands included', () => {
    const { env, input, frame } = setup();
    input.resize(LANDSCAPE, { left: 0, top: 0, width: LANDSCAPE.width, height: LANDSCAPE.height });
    env.point('move', 'mouse', 1, 1); // outside the play field
    input.read(frame);
    expect(frame.active).toBe(true);
    input.read(frame);
    expect(frame.active).toBe(false);
  });

  it.each(['down', 'up'] as const)('sees a pointer %s', (kind) => {
    const { env, input, frame } = setup();
    env.point(kind, 'touch', 100, 100);
    input.read(frame);
    expect(frame.active).toBe(true);
  });

  it('sees a pad button held and a stick beyond the dead zone, not a resting stick', () => {
    const { env, input, frame } = setup();
    env.pads = [pad([0])];
    input.read(frame);
    expect(frame.active).toBe(true);
    env.pads = [pad()];
    input.read(frame);
    expect(frame.active).toBe(false);
    const buttons = [];
    for (let i = 0; i < 17; i += 1) buttons.push({ pressed: false });
    env.pads = [{ connected: true, mapping: 'standard', buttons, axes: [0.9, 0, 0, 0] }];
    input.read(frame);
    expect(frame.active).toBe(true);
  });

  it('is never set by the automatic pause triggers', () => {
    const { env, input, frame } = setup();
    env.loseFocus();
    input.read(frame);
    expect(frame.pressed & Button.Pause).not.toBe(0);
    expect(frame.active).toBe(false);
  });
});
