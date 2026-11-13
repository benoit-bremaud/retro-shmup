import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import main from '../../src/app/main.ts?raw';

// The canvas is served at 240 × 320 and sized by script to its integer scale: shown before that
// first fit, it jumps and Lighthouse counts a layout shift (#184).
// Vitest's CSS handling empties a `?raw` stylesheet import, so the file is read from disk.
const style = readFileSync(new URL('../../src/app/style.css', import.meta.url), 'utf8');

describe('canvas first fit (#184)', () => {
  it('hides the canvas in CSS until it is fitted', () => {
    expect(style).toMatch(/#screen:not\(\.fitted\)\s*\{\s*visibility:\s*hidden;\s*\}/);
  });

  it('marks the canvas fitted once its size is set', () => {
    expect(main).toMatch(
      /visible\.style\.height = [^\n]+\n\s*visible\.classList\.add\('fitted'\);/,
    );
  });
});
