import type {
  BindingCapture,
  Bindings,
  InputPort,
  IntentFrame,
} from '../../domain/ports/input-port';
import { toSteps } from '../../domain/game/tuning';
import { isCapturableButton, isCapturableKey } from '../../domain/input/capturable';
import { InputTuning } from '../../domain/input/input-tuning';
import { Button } from '../../domain/ports/input-port';
import type { ScreenLayout } from '../../domain/presentation/screen';
import { arbitrate, createArbitration, createSample, releasePointerOwner } from './arbitration';
import type { DeviceSamples } from './arbitration';
import { GamepadModule } from './gamepad';
import type { GamepadList } from './gamepad';
import { KeyLabels } from './key-labels';
import { KeyboardModule } from './keyboard';
import { PointerModule } from './pointer';
import type { CanvasRect, PointerEventLike } from './pointer';

const NO_PADS: GamepadList = [];

/** The part of a `KeyboardEvent` the adapter reads. */
export interface KeyEventLike {
  readonly code: string;
  /** The character the layout prints, or a key name (`Shift`, `Enter`). */
  readonly key: string;
  readonly repeat: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  preventDefault(): void;
}

/** The capture's two answers that carry nothing, shared. */
const WAITING: BindingCapture = { kind: 'waiting' };
const CANCELLED: BindingCapture = { kind: 'cancelled' };
/** Reads (one per step) a gamepad capture waits before it cancels itself. */
const CAPTURE_READS = toSteps(InputTuning.captureTimeoutSeconds);
/** The standard mapping's buttons, `0` to `16`: a capture checks each against the allowlist. */
const STANDARD_BUTTONS = 17;

/**
 * A browser shortcut is a key pressed with Ctrl, Cmd or Alt held. The Ctrl and Alt keys report
 * their own flag on their own keydown, so that flag alone never makes a shortcut (GDD v0.15 §4.2:
 * they are capturable).
 */
function isShortcut(event: KeyEventLike): boolean {
  const ctrl = event.ctrlKey && !event.code.startsWith('Control');
  const alt = event.altKey && !event.code.startsWith('Alt');
  return ctrl || alt || event.metaKey;
}

/**
 * The browser objects `DeviceInput` needs, injected by the composition root as one record of
 * narrow interfaces (ADR-0015 decision 4): the adapter never references a browser global.
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
  /** The browser's keyboard layout map, where it exists (Chromium); `undefined` elsewhere. */
  layoutMap(): Promise<ReadonlyMap<string, string>> | undefined;
  /** Unlocks the audio, called inside every key and pointer gesture's handler (ADR-0009). */
  unlockAudio(): void;
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
  /** A physical event since the last read (ADR-0009, amended); the automatic triggers never set it. */
  private eventSinceRead = false;
  /** Shortcut keys held: activity only, never game input (Meta does not auto-repeat). */
  private readonly shortcutsDown = new Set<string>();
  /** A fullscreen wish not applied yet: the next key or pointer press applies it, once. */
  private pendingFullscreen: boolean | undefined;
  /** The device a capture waits for, or none (GDD v0.15 §4.2). */
  private capturing: keyof Bindings | undefined;
  private captured: BindingCapture = WAITING;
  private captureReadsLeft = 0;
  private readonly keyLabels = new KeyLabels();

  constructor(environment: InputEnvironment) {
    this.environment = environment;
    // The layout map is asynchronous; until it resolves, the US characters stand in.
    environment
      .layoutMap()
      ?.then((layout) => {
        this.keyLabels.useLayout(layout);
      })
      .catch(() => undefined); // refused (an iframe, a policy): the US characters stay
    environment.onKeyDown((event) => {
      this.eventSinceRead = true; // any key is the player touching the game, a shortcut too
      // A browser shortcut is never a game input and keeps its action.
      if (isShortcut(event)) {
        this.shortcutsDown.add(event.code);
        return;
      }
      this.seq += 1;
      this.onGesture();
      this.keyLabels.learn(event.code, event.key);
      // While a keyboard capture waits, a key only answers it: it latches no intent, so the
      // answering step carries no menu action (GDD v0.15 §4.2).
      if (this.capturing === 'keyboard' && this.captured.kind === 'waiting') {
        if (this.captureKey(event)) event.preventDefault();
        return;
      }
      if (this.keyboard.keyDown(event.code, event.repeat, this.seq)) event.preventDefault();
    });
    environment.onKeyUp((event) => {
      this.shortcutsDown.delete(event.code);
      this.keyboard.keyUp(event.code);
    });
    environment.onFocusLost(() => {
      // Clear first: no key release arrives after a blur (ADR-0015 decision 5).
      this.keyboard.release();
      this.shortcutsDown.clear();
      this.pointer.release();
      this.arbitration.clearedAt = this.seq;
      this.automaticPause = true;
      this.cancelCapture();
    });
    environment.onPointerDown((event) => {
      this.eventSinceRead = true;
      this.seq += 1;
      this.onGesture();
      this.pointer.down(event, this.seq);
    });
    environment.onPointerMove((event) => {
      this.eventSinceRead = true; // anywhere on the page, the side bands too
      this.seq += 1;
      this.pointer.move(event, this.seq);
    });
    environment.onPointerUp((event) => {
      this.eventSinceRead = true;
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
    if (this.gamepad.poll(this.padsOrNone(), this.seq)) {
      this.automaticPause = true;
      this.cancelCapture(); // the active pad lost cancels a capture (GDD v0.15 §4.2)
    }
    this.captureButton();
    this.gamepad.sample(this.samples.gamepad);
    arbitrate(this.arbitration, this.samples, into);
    if (this.automaticPause) into.pressed |= Button.Pause;
    this.automaticPause = false;
    this.pointer.takePointerEvents(into);
    into.fullscreen = this.environment.fullscreen.active();
    const keyHeld = this.keyboard.anyDown || this.shortcutsDown.size > 0;
    into.active = this.eventSinceRead || keyHeld || this.gamepad.anyHeld;
    this.eventSinceRead = false;
  }

  /** Inside a gesture's handler, the only place browsers allow audio and fullscreen (ADR-0009). */
  private onGesture(): void {
    this.environment.unlockAudio();
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

  startCapture(device: keyof Bindings): void {
    this.capturing = device;
    this.captured = WAITING;
    this.captureReadsLeft = CAPTURE_READS;
  }

  captureNext(): BindingCapture {
    if (this.capturing === undefined) return CANCELLED;
    const answer = this.captured;
    if (answer.kind !== 'waiting') this.capturing = undefined;
    return answer;
  }

  /** Cancels a capture still waiting; an answer already given is kept (a tap in the same step). */
  cancelCapture(): void {
    if (this.capturing !== undefined && this.captured.kind === 'waiting') this.captured = CANCELLED;
  }

  label(code: string): string {
    return this.keyLabels.label(code);
  }

  /**
   * A keyboard capture's answer (GDD v0.15 §4.2): `Escape` cancels and keeps its browser action,
   * a capturable key answers, any other key is refused; every key but `Escape` is prevented while
   * waiting. Returns whether to prevent the browser action.
   */
  private captureKey(event: KeyEventLike): boolean {
    if (event.code === 'Escape') {
      this.captured = CANCELLED;
      return false;
    }
    if (!event.repeat && isCapturableKey(event.code)) {
      this.captured = { kind: 'key', code: event.code };
    }
    return true;
  }

  /** A gamepad capture's answer at each read: the lowest capturable button that went down. */
  private captureButton(): void {
    if (this.capturing !== 'gamepad' || this.captured.kind !== 'waiting') return;
    const presses = this.gamepad.pressesOfLastPoll;
    for (let index = 0; index < STANDARD_BUTTONS; index += 1) {
      if ((presses & (1 << index)) !== 0 && isCapturableButton(index)) {
        this.captured = { kind: 'button', index };
        return;
      }
    }
    this.captureReadsLeft -= 1;
    if (this.captureReadsLeft <= 0) this.captured = CANCELLED;
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
