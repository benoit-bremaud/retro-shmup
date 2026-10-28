import { describe, expect, it } from 'vitest';
import { hudGlyph, menuGlyph, titleGlyph } from '../../src/adapters/hud-font';

const SPACE = 0x20;

describe('hud-font glyph sets', () => {
  it('draws a space in the title set as an empty glyph', () => {
    expect(titleGlyph(SPACE)?.every((row) => row === 0)).toBe(true);
  });

  it('draws nothing for a code point outside the title set', () => {
    expect(titleGlyph(0x21)).toBeUndefined();
  });

  it('falls back to the title set for letters and spaces in the menu set', () => {
    expect(menuGlyph(0x41)).toEqual(titleGlyph(0x41));
    expect(menuGlyph(SPACE)).toEqual(titleGlyph(SPACE));
  });

  it('draws the hud font × in the menu set, for the chain label (GDD v0.32 §7.3)', () => {
    expect(menuGlyph(0xd7)).toEqual(hudGlyph(0xd7));
  });
});
