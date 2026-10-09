import type {
  BindingCapture,
  Bindings,
  InputPort,
  IntentFrame,
} from '../../domain/ports/input-port';
import { Button } from '../../domain/ports/input-port';
import { KeyboardModule } from './keyboard';
import type { KeyboardSample } from './keyboard';

/** The part of a `KeyboardEvent` the adapter reads. */
export interface KeyEventLike {
  readonly code: string;
  readonly repeat: boolean;
  preventDefault(): void;
}

/**
 * The browser objects `DeviceInput` needs, injected by the composition root as one record of
 * narrow interfaces (ADR-0015 decision 4): the adapter never references a browser global. The
 * pointer, gamepad, fullscreen and audio-unlock members join with their devices.
 */
export interface InputEnvironment {
  onKeyDown(listener: (event: KeyEventLike) => void): void;
  onKeyUp(listener: (event: KeyEventLike) => void): void;
  /** Window blur or page hidden. */
  onFocusLost(listener: () => void): void;
}

/**
 * The single `InputPort` implementation, a façade over per-device modules (ADR-0015 decision 4).
 * The keyboard is the only device of the first playable; the arbitration function arrives with
 * the second device.
 */
export class DeviceInput implements InputPort {
  private readonly keyboard = new KeyboardModule();
  private readonly keys: KeyboardSample = {
    moving: false,
    moveX: 0,
    moveY: 0,
    held: 0,
    pressed: 0,
  };
  private automaticPause = false;

  constructor(environment: InputEnvironment) {
    environment.onKeyDown((event) => {
      if (this.keyboard.keyDown(event.code, event.repeat)) event.preventDefault();
    });
    environment.onKeyUp((event) => {
      this.keyboard.keyUp(event.code);
    });
    environment.onFocusLost(() => {
      // Clear first: no key release arrives after a blur (ADR-0015 decision 5).
      this.keyboard.release();
      this.automaticPause = true;
    });
  }

  read(into: IntentFrame): void {
    this.keyboard.sample(this.keys);
    into.device = 'keyboard';
    into.moveKind = this.keys.moving ? 'direction' : 'none';
    into.moveX = this.keys.moveX;
    into.moveY = this.keys.moveY;
    into.held = this.keys.held;
    into.pressed = this.keys.pressed | (this.automaticPause ? Button.Pause : 0);
    this.automaticPause = false;
    into.tapRegion = 'none';
    into.tapX = 0;
    into.tapY = 0;
    into.fullscreen = false;
  }

  setBindings(bindings: Bindings): void {
    this.keyboard.setBindings(bindings);
  }

  /** Key capture arrives with the options screen. */
  captureNext(): BindingCapture {
    return { kind: 'cancelled' };
  }

  /** Layout-aware labels arrive with the options screen. */
  label(code: string): string {
    return code;
  }

  /** Fullscreen arrives with the options screen. */
  setFullscreenWanted(_wanted: boolean): void {
    // Nothing to do until the options screen can ask for fullscreen.
  }
}
