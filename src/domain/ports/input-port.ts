/** Button intents as bit flags, combined in `IntentFrame.held` and `IntentFrame.pressed` (ADR-0009). */
export const Button = {
  Fire: 1,
  Bomb: 2,
  Pause: 4,
  Confirm: 8,
  Back: 16,
} as const;

export type Device = 'keyboard' | 'gamepad' | 'touch' | 'mouse';
export type MoveKind = 'none' | 'direction' | 'target';
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
  /** Current fullscreen state, as reported by the browser. */
  fullscreen: boolean;
}

/** Intents the player can remap (GDD §4.2); `confirm` and `back` are fixed. */
export type RemappableIntent =
  'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'fire' | 'bomb' | 'pause';

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
  /** Polls the "press the new key" capture started by the options screen. */
  captureNext(): BindingCapture;
  /** Label of a physical key in the active keyboard layout. */
  label(code: string): string;
  /** Applied at the next click, tap or key press — browsers require a gesture. */
  setFullscreenWanted(wanted: boolean): void;
}
