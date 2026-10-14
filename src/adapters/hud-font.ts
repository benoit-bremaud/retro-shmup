/**
 * Glyphs of the placeholder bitmap fonts (RenderPort contract): 3 × 5 pixels, each row a 3-bit
 * mask, most significant bit on the left. `hud`: digits, `×` (U+00D7) and the
 * space, an empty cell for the grouped Results values (ADR-0022 decision 8); `title`: `A`–`Z` and
 * the space. The screens brick replaces them with the final bitmap fonts.
 */
const DIGITS: readonly (readonly number[])[] = [
  [0b111, 0b101, 0b101, 0b101, 0b111],
  [0b010, 0b110, 0b010, 0b010, 0b111],
  [0b111, 0b001, 0b111, 0b100, 0b111],
  [0b111, 0b001, 0b111, 0b001, 0b111],
  [0b101, 0b101, 0b111, 0b001, 0b001],
  [0b111, 0b100, 0b111, 0b001, 0b111],
  [0b111, 0b100, 0b111, 0b101, 0b111],
  [0b111, 0b001, 0b001, 0b001, 0b001],
  [0b111, 0b101, 0b111, 0b101, 0b111],
  [0b111, 0b101, 0b111, 0b001, 0b111],
];
const TIMES_GLYPH: readonly number[] = [0b000, 0b101, 0b010, 0b101, 0b000];

const LETTERS: readonly (readonly number[])[] = [
  [0b010, 0b101, 0b111, 0b101, 0b101], // A
  [0b110, 0b101, 0b110, 0b101, 0b110], // B
  [0b011, 0b100, 0b100, 0b100, 0b011], // C
  [0b110, 0b101, 0b101, 0b101, 0b110], // D
  [0b111, 0b100, 0b110, 0b100, 0b111], // E
  [0b111, 0b100, 0b110, 0b100, 0b100], // F
  [0b011, 0b100, 0b101, 0b101, 0b011], // G
  [0b101, 0b101, 0b111, 0b101, 0b101], // H
  [0b111, 0b010, 0b010, 0b010, 0b111], // I
  [0b001, 0b001, 0b001, 0b101, 0b010], // J
  [0b101, 0b101, 0b110, 0b101, 0b101], // K
  [0b100, 0b100, 0b100, 0b100, 0b111], // L
  [0b101, 0b111, 0b111, 0b101, 0b101], // M
  [0b110, 0b101, 0b101, 0b101, 0b101], // N
  [0b010, 0b101, 0b101, 0b101, 0b010], // O
  [0b110, 0b101, 0b110, 0b100, 0b100], // P
  [0b010, 0b101, 0b101, 0b110, 0b011], // Q
  [0b110, 0b101, 0b110, 0b101, 0b101], // R
  [0b011, 0b100, 0b010, 0b001, 0b110], // S
  [0b111, 0b010, 0b010, 0b010, 0b010], // T
  [0b101, 0b101, 0b101, 0b101, 0b111], // U
  [0b101, 0b101, 0b101, 0b101, 0b010], // V
  [0b101, 0b101, 0b111, 0b111, 0b101], // W
  [0b101, 0b101, 0b010, 0b101, 0b101], // X
  [0b101, 0b101, 0b010, 0b010, 0b010], // Y
  [0b111, 0b001, 0b010, 0b100, 0b111], // Z
];
const SPACE_GLYPH: readonly number[] = [0, 0, 0, 0, 0];

/** ← ↑ → ↓, the menu font's arrows for the arrow keys and the d-pad (GDD v0.15 §4.2). */
const ARROWS: readonly (readonly number[])[] = [
  [0b001, 0b010, 0b100, 0b010, 0b001],
  [0b010, 0b111, 0b010, 0b010, 0b010],
  [0b100, 0b010, 0b001, 0b010, 0b100],
  [0b010, 0b010, 0b010, 0b111, 0b010],
];
const ARROW_LEFT = 0x2190;
const ARROW_DOWN = 0x2193;

const ZERO = 0x30;
const NINE = 0x39;
const TIMES = 0xd7;
const LETTER_A = 0x41;
const LETTER_Z = 0x5a;
const SPACE = 0x20;

/** The `hud` glyph cell is 3 columns by 5 rows. */
export const GLYPH_COLUMNS = 3;
/** Rows of the `hud` glyph cell, see `GLYPH_COLUMNS`. */
export const GLYPH_ROWS = 5;

/** The rows of a `hud` glyph for a code point, or `undefined` outside its set. */
export function hudGlyph(code: number): readonly number[] | undefined {
  if (code >= ZERO && code <= NINE) return DIGITS[code - ZERO];
  if (code === TIMES) return TIMES_GLYPH;
  return code === SPACE ? SPACE_GLYPH : undefined;
}

/** The rows of a `menu` glyph: the `title` set, the digits and the four arrows. */
export function menuGlyph(code: number): readonly number[] | undefined {
  if (code >= ZERO && code <= NINE) return DIGITS[code - ZERO];
  if (code >= ARROW_LEFT && code <= ARROW_DOWN) return ARROWS[code - ARROW_LEFT];
  return titleGlyph(code);
}

/** The rows of a `title` glyph for a code point, or `undefined` outside its set. */
export function titleGlyph(code: number): readonly number[] | undefined {
  if (code >= LETTER_A && code <= LETTER_Z) return LETTERS[code - LETTER_A];
  return code === SPACE ? SPACE_GLYPH : undefined;
}
