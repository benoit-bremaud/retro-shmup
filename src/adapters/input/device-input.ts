import type {
  BindingCapture,
  Bindings,
  InputPort,
  IntentFrame,
} from '../../domain/ports/input-port';
import { Button } from '../../domain/ports/input-port';
import { arbitrate, createArbitration, createSample } from './arbitration';
import type { DeviceSamples } from './arbitration';
import { KeyboardModule } from './keyboard';

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
 * It numbers every keydown (later every pointer event and gamepad start), and combines the device
 * samples with the
 * browser-free `arbitrate` (ADR-0018 decision 9). The keyboard is the only device so far; the
 * pointer and gamepad samples stay idle until their modules land.
 */
export class DeviceInput implements InputPort {
  private readonly keyboard = new KeyboardModule();
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

  constructor(environment: InputEnvironment) {
    environment.onKeyDown((event) => {
      // A browser shortcut (Ctrl, Cmd or Alt held) is never a game input and keeps its action.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      this.seq += 1;
      if (this.keyboard.keyDown(event.code, event.repeat, this.seq)) event.preventDefault();
    });
    environment.onKeyUp((event) => {
      this.keyboard.keyUp(event.code);
    });
    environment.onFocusLost(() => {
      // Clear first: no key release arrives after a blur (ADR-0015 decision 5).
      this.keyboard.release();
      this.arbitration.clearedAt = this.seq;
      this.automaticPause = true;
    });
  }

  read(into: IntentFrame): void {
    this.keyboard.sample(this.samples.keyboard);
    arbitrate(this.arbitration, this.samples, into);
    if (this.automaticPause) into.pressed |= Button.Pause;
    this.automaticPause = false;
    into.tapRegion = 'none';
    into.tapX = 0;
    into.tapY = 0;
    into.fullscreen = false; // reported by the browser once fullscreen lands with the options
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
