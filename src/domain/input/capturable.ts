/**
 * The keys and buttons a slot can hold (GDD v0.15 §4.2): a closed set, so every label fits the
 * menu font in 10 characters, and the browser's own keys (`Tab`, `F1`–`F12`, the system keys) and
 * the fixed `Enter`, `NumpadEnter` and `Escape` are never bound. The save document's bindings are
 * checked against the same set (ADR-0006).
 */
const NAMED_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'Backspace',
]);

/** `KeyA`–`KeyZ`, `Digit0`–`Digit9`, `Numpad0`–`Numpad9`. */
const CHARACTER_KEY = /^(Key[A-Z]|Digit\d|Numpad\d)$/;

/** The highest standard-mapping button a slot can hold; 16, the home button, is the system's. */
const LAST_BUTTON = 15;

export function isCapturableKey(code: string): boolean {
  return NAMED_KEYS.has(code) || CHARACTER_KEY.test(code);
}

export function isCapturableButton(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index <= LAST_BUTTON;
}
