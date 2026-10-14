import { message } from '../i18n/messages';
import type { Language, MessageKey } from '../i18n/messages';

/**
 * The names the controls screen shows (GDD v0.15 §4.2), each of 10 characters at most, as
 * strings built once: a draw builds none. The arrows and the numpad read the same in every
 * language; the keys named by language go through the catalogue.
 */
const ARROW_NAMES: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowRight: '→',
  ArrowDown: '↓',
};

const NUMPAD_NAMES: Readonly<Record<string, string>> = {
  Numpad0: 'NUM 0',
  Numpad1: 'NUM 1',
  Numpad2: 'NUM 2',
  Numpad3: 'NUM 3',
  Numpad4: 'NUM 4',
  Numpad5: 'NUM 5',
  Numpad6: 'NUM 6',
  Numpad7: 'NUM 7',
  Numpad8: 'NUM 8',
  Numpad9: 'NUM 9',
};

const NAMED_KEYS: Readonly<Record<string, MessageKey>> = {
  Space: 'keySpace',
  ShiftLeft: 'keyShiftLeft',
  ShiftRight: 'keyShiftRight',
  ControlLeft: 'keyControlLeft',
  ControlRight: 'keyControlRight',
  AltLeft: 'keyAltLeft',
  AltRight: 'keyAltRight',
  Backspace: 'keyBackspace',
};

/** The standard mapping's buttons 0 to 15 (16, the home button, is never bound). */
const BUTTON_NAMES: readonly string[] = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'SELECT',
  'START',
  'L3',
  'R3',
  '↑',
  '↓',
  '←',
  '→',
];

/**
 * A key's name: the character the player's layout prints for a letter or digit key (`printed`,
 * the input port's `label`), else the arrow glyph, the numpad name, or the catalogue's name.
 */
export function keyName(
  code: string,
  language: Language,
  printed: (code: string) => string,
): string {
  const character = printed(code);
  if (character !== '') return character;
  const fixed = ARROW_NAMES[code] ?? NUMPAD_NAMES[code];
  if (fixed !== undefined) return fixed;
  const key = NAMED_KEYS[code];
  return key === undefined ? '' : message(key, language);
}

/** A gamepad button's standard name, or `''` outside buttons 0 to 15. */
export function buttonName(index: number): string {
  return BUTTON_NAMES[index] ?? '';
}
