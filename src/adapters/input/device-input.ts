import type {
  BindingCapture,
  Bindings,
  InputPort,
  IntentFrame,
} from '../../domain/ports/input-port';
import { Button } from '../../domain/ports/input-port';
import type { ScreenLayout } from '../../domain/presentation/screen';
import { arbitrate, createArbitration, createSample, releasePointerOwner } from './arbitration';
import type { DeviceSamples } from './arbitration';
import { GamepadModule } from './gamepad';
import type { GamepadList } from './gamepad';
import { KeyboardModule } from './keyboard';
import { PointerModule } from './pointer';
import type { CanvasRect, PointerEventLike } from './pointer';

const NO_PADS: GamepadList = [];

/** The part of a `KeyboardEvent` the adapter reads. */
export interface KeyEventLike {
  readonly code: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  preventDefault(): void;
}

/**
 * The browser objects `DeviceInput` needs, injected by the composition root as one record of
 * narrow interfaces (ADR-0015 decision 4): the adapter never references a browser global. The
 * audio-unlock member joins with the audio.
 */
export interface InputEnvironment {
  onKeyDown(listener: (event: KeyEventLike) => void): void;
  onKeyUp(listener: (event: KeyEventLike) => void): void;
  /** Window blur or page hidden. */
  onFocusLost(listener: () => void): void;
  /** Pointer events of the whole page, not only the canvas (ADR-0018 decision 6). */
  onPointerDown(listener: (event: PointerEventLike) => void): void;
  onPointerMove(listener: (event: PointerEventLike) => void): void;
  onPointerUp(listener: (event: PointerEventLike) => void): void;
  onPointerCancel(listener: (event: PointerEventLike) => void): void;
  /** `navigator.getGamepads()`, polled once per read. */
  gamepads(): GamepadList;
  /** The page's fullscreen state and requests, called only inside a gesture's handler. */
  readonly fullscreen: {
    active(): boolean;
    request(): void;
    exit(): void;
  };
}

/**
 * The single `InputPort` implementation, a façade over per-device modules (ADR-0015 decision 4).
 * It numbers every keydown and pointer event, then the gamepad poll last in each read, and
 * combines the device samples with the browser-free `arbitrate` (ADR-0018 decision 9).
 */
export class DeviceInput implements InputPort {
  private readonly keyboard = new KeyboardModule();
  private readonly pointer = new PointerModule();
  private readonly gamepad = new GamepadModule();
  private readonly environment: InputEnvironment;
  private readonly samples: DeviceSamples = {
    keyboard: createSample(),
    touch: createSample(),
    mouse: createSample(),
    gamepad: createSample(),
  };
  private readonly arbitration = createArbitration();
  /** The façade's sequence number: one per input event (ADR-0018 decision 9). */
  private seq = 0;
  /** One `Pause` press for lost focus, delivered by the next `read` (ADR-0009). */
  private automaticPause = false;
  /** A fullscreen wish not applied yet: the next key or pointer press applies it, once. */
  private pendingFullscreen: boolean | undefined;

  constructor(environment: InputEnvironment) {
    this.environment = environment;
    environment.onKeyDown((event) => {
      // A browser shortcut (Ctrl, Cmd or Alt held) is never a game input and keeps its action.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      this.seq += 1;
      this.applyFullscreen();
      if (this.keyboard.keyDown(event.code, event.repeat, this.seq)) event.preventDefault();
    });
    environment.onKeyUp((event) => {
      this.keyboard.keyUp(event.code);
    });
    environment.onFocusLost(() => {
      // Clear first: no key release arrives after a blur (ADR-0015 decision 5).
      this.keyboard.release();
      this.pointer.release();
      this.arbitration.clearedAt = this.seq;
      this.automaticPause = true;
    });
    environment.onPointerDown((event) => {
      this.seq += 1;
      this.applyFullscreen();
      this.pointer.down(event, this.seq);
    });
    environment.onPointerMove((event) => {
      this.seq += 1;
      this.pointer.move(event, this.seq);
    });
    environment.onPointerUp((event) => {
      this.seq += 1;
      this.pointer.up(event, this.seq);
    });
    environment.onPointerCancel((event) => {
      this.pointer.cancel(event);
    });
  }

  /**
   * Takes the screen and the canvas client rectangle, read once per resize by the composition root
   * (ADR-0018 decision 6). A change of layout kind pauses (decision 7); the first call, at boot,
   * only sets the layout.
   */
  resize(layout: ScreenLayout, rect: CanvasRect): void {
    if (this.pointer.resize(layout, rect)) this.automaticPause = true;
  }

  read(into: IntentFrame): void {
    this.keyboard.sample(this.samples.keyboard);
    this.pointer.sampleTouch(this.samples.touch);
    this.pointer.sampleMouse(this.samples.mouse);
    // The poll applies after this read's events (ADR-0015 decision 5); a lost active pad pauses.
    this.seq += 1;
    if (this.gamepad.poll(this.padsOrNone(), this.seq)) this.automaticPause = true;
    this.gamepad.sample(this.samples.gamepad);
    arbitrate(this.arbitration, this.samples, into);
    if (this.automaticPause) into.pressed |= Button.Pause;
    this.automaticPause = false;
    this.pointer.takePointerEvents(into);
    into.fullscreen = this.environment.fullscreen.active();
  }

  /** Inside a gesture's handler, the only place browsers allow it (ADR-0009). */
  private applyFullscreen(): void {
    const wanted = this.pendingFullscreen;
    if (wanted === undefined) return;
    this.pendingFullscreen = undefined;
    const active = this.environment.fullscreen.active();
    if (wanted && !active) this.environment.fullscreen.request();
    if (!wanted && active) this.environment.fullscreen.exit();
  }

  /**
   * The pads, or none when the browser refuses them: `getGamepads` throws when the `gamepad`
   * Permissions-Policy is denied (an embedding iframe) or is missing outside a secure context.
   * Failing closed to "no pad" keeps every other device playing (issue #9).
   */
  private padsOrNone(): GamepadList {
    try {
      return this.environment.gamepads();
    } catch {
      return NO_PADS;
    }
  }

  setBindings(bindings: Bindings): void {
    this.keyboard.setBindings(bindings);
    this.gamepad.setBindings(bindings);
  }

  /** Key capture arrives with the options screen. */
  captureNext(): BindingCapture {
    return { kind: 'cancelled' };
  }

  /** Layout-aware labels arrive with the options screen. */
  label(code: string): string {
    return code;
  }

  setFullscreenWanted(wanted: boolean): void {
    this.pendingFullscreen = wanted;
  }

  setAutofire(on: boolean): void {
    this.pointer.setAutofire(on);
  }

  releaseMovement(): void {
    this.seq += 1;
    releasePointerOwner(this.arbitration, this.samples, this.seq);
  }
}
