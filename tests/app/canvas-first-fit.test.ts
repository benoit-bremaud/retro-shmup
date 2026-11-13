import { describe, expect, it } from 'vitest';
import main from '../../src/app/main.ts?raw';

// The canvas is served at 240 × 320 and sized by script to its integer scale. style.css hides it
// until it is fitted, so it never jumps on screen (no layout shift, #184); the browser smoke test
// asserts the canvas is visible after load, which covers both files at runtime.
describe('canvas first fit (#184)', () => {
  it('marks the canvas fitted in fitToWindow', () => {
    expect(main).toContain("visible.classList.add('fitted')");
  });
});
