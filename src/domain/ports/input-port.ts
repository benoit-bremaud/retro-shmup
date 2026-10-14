/** Button intents as bit flags, combined in `IntentFrame.held` and `IntentFrame.pressed` (ADR-0009). */
export const Button = {
  Fire: 1,
  Bomb: 2,
  Pause: 4,
  Confirm: 8,
  Back: 16,
} as const;

/** The device that produced an intent frame; the arbitration picks the last one used. */
export type Device = 'keyboard' | 'gamepad' | 'touch' | 'mouse';
/** `direction`: stick or keys in [-1, 1]; `target`: a point to follow (touch, mouse). */
export type MoveKind = 'none' | 'direction' | 'target';
/** Where this step's tap landed: on the play field, on the HUD strip, or nowhere. */
export type TapRegion = 'none' | 'field' | 'hud';

/**
 * One reusable, flat frame of player intents, filled in place once per simulation step
 * (ADR-0009). `direction`: (moveX, moveY) in [-1, 1]; `target`: play-field pixels.
 */
export interface IntentFrame {
  /** Last device used wins. */
  device: Device;
  moveKind: MoveKind;
  moveX: number;
  moveY: number;
  /** Button bitmask: buttons down now. */
  held: number;
  /** Button bitmask: buttons that went down since the previous read. */
  pressed: number;
  /** `none` when there was no tap since the previous read. */
  tapRegion: TapRegion;
  /** In the region's coordinates (play field or HUD band), not screen pixels. */
  tapX: number;
  tapY: number;
  /**
   * Where a finger or the left mouse button was released since the previous read, in the
   * coordinates of a tap; `none` when nothing was, or the finger was cancelled. Menus activate a
   * row on release (GDD v0.13 §9.1).
   */
  releaseRegion: TapRegion;
  releaseX: number;
  releaseY: number;
  /** The mouse moved to a new play-field point since the previous read (menu highlight). */
  hovered: boolean;
  /** Play-field pixels; meaningful when `hovered`. */
  hoverX: number;
  hoverY: number;
  /** Current fullscreen state, as reported by the browser. */
  fullscreen: boolean;
}

/**
 * Intents the player can remap (GDD §4.2), in the controls screen's order (v0.15); `confirm` and
 * `back` are fixed. The type derives from the list, so an intent is never in one and not the other.
 */
export const REMAPPABLE_INTENTS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'fire',
  'bomb',
  'pause',
] as const;
export type RemappableIntent = (typeof REMAPPABLE_INTENTS)[number];

/** A primary input that always exists and an optional secondary one (ADR-0012). */
export interface BindingSlots<T> {
  readonly primary: T;
  readonly secondary: T | null;
}

/** Keyboard slots hold `KeyboardEvent.code`; gamepad slots hold standard-mapping indices (ADR-0012). */
export interface Bindings {
  readonly keyboard: Readonly<Record<RemappableIntent, BindingSlots<string>>>;
  readonly gamepad: Readonly<Record<RemappableIntent, BindingSlots<number>>>;
}

/** State of the "press the new key" capture; `cancelled` on `Esc` or the 5 s gamepad timeout. */
export type BindingCapture =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'key'; readonly code: string }
  | { readonly kind: 'button'; readonly index: number };

/** Player input, whatever the device (ADR-0009). */
export interface InputPort {
  /** Fills the caller's frame in place; called once per simulation step. */
  read(into: IntentFrame): void;
  setBindings(bindings: Bindings): void;
  /**
   * Starts waiting for the next capturable key or button of `device` (GDD v0.15 §4.2); an input
   * already held does not answer, and every key's browser action but `Escape`'s is prevented.
   */
  startCapture(device: keyof Bindings): void;
  /**
   * Polls the capture: `waiting`, then once a `key`, a `button` or `cancelled` (`Escape`, the
   * gamepad's `InputTuning.captureTimeoutSeconds`, a lost focus or pad); `cancelled` too when no
   * capture is pending. A key that answers latches no intent.
   */
  captureNext(): BindingCapture;
  /** Stops the capture: a tap, leaving the screen or an automatic pause (GDD v0.15 §4.2). */
  cancelCapture(): void;
  /**
   * The character a letter or digit key prints in the player's layout, as one character of
   * `A`–`Z` or `0`–`9`; `''` for a key without one (the domain names the others).
   */
  label(code: string): string;
  /**
   * Applied once, at the next click, tap or key press — browsers require a gesture; leaving
   * fullscreen by the browser's own key is never undone by the game.
   */
  setFullscreenWanted(wanted: boolean): void;
  /** Touch and mouse fire all the time while they own the movement (ADR-0020 decision 4). */
  setAutofire(on: boolean): void;
  /**
   * Drops the movement owner if it is touch or the mouse, as the game leaves a menu for play (GDD
   * v0.14 §9.1); a keyboard or gamepad owner, held buttons and the pause are untouched.
   */
  releaseMovement(): void;
}

/** A neutral frame: no movement, no button, no tap. Created once and reused (ADR-0009). */
export function createIntentFrame(): IntentFrame {
  return {
    device: 'keyboard',
    moveKind: 'none',
    moveX: 0,
    moveY: 0,
    held: 0,
    pressed: 0,
    tapRegion: 'none',
    tapX: 0,
    tapY: 0,
    releaseRegion: 'none',
    releaseX: 0,
    releaseY: 0,
    hovered: false,
    hoverX: 0,
    hoverY: 0,
    fullscreen: false,
  };
}
