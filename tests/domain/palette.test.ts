import { describe, expect, it } from 'vitest';
import { Palette } from '../../src/domain/presentation/palette';

describe('Palette — colour tokens', () => {
  it('gives every token its own colour, so a colour identifies what was drawn', () => {
    const colours = Object.values(Palette);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
