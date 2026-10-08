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
  device: Device;
  moveKind: MoveKind;
  moveX: number;
  moveY: number;
  /** Button bitmask: buttons down now. */
  held: number;
  /** Button bitmask: buttons that went down since the previous read. */
  pressed: number;
  tapRegion: TapRegion;
  tapX: number;
  tapY: number;
  /** Current fullscreen state, as reported by the browser. */
  fullscreen: boolean;
}

/** Intents the player can remap (GDD §4.2); `confirm` and `back` are fixed. */
export type RemappableIntent =
  'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'fire' | 'bomb' | 'pause';

/** Primary and secondary physical inputs of one intent (`KeyboardEvent.code` or a button id). */
export type BindingSlots = readonly [primary: string | null, secondary: string | null];

export interface Bindings {
  readonly keyboard: Readonly<Record<RemappableIntent, BindingSlots>>;
  readonly gamepad: Readonly<Record<RemappableIntent, BindingSlots>>;
}

export type BindingCapture = 'waiting' | 'cancelled' | { readonly code: string };

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
