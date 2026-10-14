/**
 * A letter or digit key. Numpad digits are capturable too (`capturable.ts`) but print the same on
 * every layout: `label` gives them `''` and the domain names them, like the other named keys.
 */
const CHARACTER_KEY = /^(?:Key[A-Z]|Digit\d)$/;

/** `character` when the menu font can draw it (`A`–`Z`, `0`–`9`), else `undefined`. */
function drawable(character: string | undefined): string | undefined {
  return character !== undefined && /^[A-Z\d]$/.test(character) ? character : undefined;
}

/**
 * The `KeyLabels` part of the input adapter (GDD v0.15 §4.2, meta/04-class-menus): the character a
 * letter or digit key prints in the player's layout — learned from the session's key events, else
 * the browser's layout map, else the US character. Everything is kept in capitals as it arrives,
 * so `label`, read at each draw, builds no string. Nothing is saved or sent (PRIV-1).
 */
export class KeyLabels {
  /** What each letter or digit key printed this session: physical key → character. */
  private readonly printed = new Map<string, string>();
  /** The browser's layout map once it resolved, in capitals, else empty. */
  private layout: ReadonlyMap<string, string> = new Map();

  /** A key event: what a letter or digit key printed, when the menu font can draw it. */
  learn(code: string, key: string): void {
    if (!CHARACTER_KEY.test(code)) return;
    const character = drawable(key.toUpperCase());
    if (character !== undefined) this.printed.set(code, character);
  }

  /** The browser's layout map, once, when it resolves (Chromium only). */
  useLayout(layout: ReadonlyMap<string, string>): void {
    const upper = new Map<string, string>();
    layout.forEach((character, code) => upper.set(code, character.toUpperCase()));
    this.layout = upper;
  }

  /** The character to show for a key, or `''` for a key the domain names. */
  label(code: string): string {
    if (!CHARACTER_KEY.test(code)) return '';
    // The US character is the code's last one (`KeyQ` → `Q`), a cached one-character string.
    const us = code.charAt(code.length - 1);
    return this.printed.get(code) ?? drawable(this.layout.get(code)) ?? us;
  }
}
