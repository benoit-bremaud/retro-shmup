/**
 * Glyphs of the `hud` font (RenderPort contract): 3 × 5 pixels, each row a 3-bit mask, most
 * significant bit on the left. Digits `0`–`9` by code point, then `×` (U+00D7).
 */
const GLYPHS: readonly (readonly number[])[] = [
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
  [0b000, 0b101, 0b010, 0b101, 0b000],
];

const ZERO = 0x30;
const NINE = 0x39;
const TIMES = 0xd7;
const TIMES_GLYPH = 10;

/** Logical pixels per glyph pixel. */
export const HUD_GLYPH_SCALE = 2;
export const HUD_GLYPH_COLUMNS = 3;
export const HUD_GLYPH_ROWS = 5;

/** The rows of the glyph for a code point, or `undefined` outside the glyph set. */
export function hudGlyph(code: number): readonly number[] | undefined {
  if (code >= ZERO && code <= NINE) return GLYPHS[code - ZERO];
  return code === TIMES ? GLYPHS[TIMES_GLYPH] : undefined;
}
