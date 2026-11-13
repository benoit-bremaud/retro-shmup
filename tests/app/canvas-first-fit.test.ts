import { describe, expect, it } from 'vitest';
import main from '../../src/app/main.ts?raw';

// The canvas is served at 240 × 320 and sized by script to its integer scale. style.css hides it
// until it is fitted, so it never jumps on screen (no layout shift, #184); the browser smoke test
// proves it is shown again, since Playwright acts only on a visible canvas.
describe('canvas first fit (#184)', () => {
  it('marks the canvas fitted once its size is set', () => {
    expect(main).toMatch(
      /visible\.style\.height = [^\n]+\n\s*visible\.classList\.add\('fitted'\);/,
    );
  });
});
