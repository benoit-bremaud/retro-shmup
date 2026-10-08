import { describe, expect, it } from 'vitest';
import { computeViewport } from '../../src/adapters/viewport';

describe('computeViewport (ADR-0014)', () => {
  it.each([
    { name: '1080p, 16:9', w: 1920, h: 1080, dpr: 1, scale: 3 },
    { name: '1440p, 16:9', w: 2560, h: 1440, dpr: 1, scale: 4 },
    { name: '16:10 laptop', w: 1680, h: 1050, dpr: 1, scale: 3 },
    { name: '1366 × 768 laptop', w: 1366, h: 768, dpr: 1, scale: 2 },
  ])('keeps an integer scale of $scale on a $name screen', ({ w, h, dpr, scale }) => {
    expect(computeViewport(w, h, dpr).scale).toBe(scale);
  });

  it.each([
    { dpr: 1.25, w: 1536, h: 864, scale: 3 },
    { dpr: 1.5, w: 1280, h: 720, scale: 3 },
    { dpr: 1.75, w: 1097, h: 617, scale: 3 },
    { dpr: 3, w: 390, h: 844, scale: 2 },
  ])('keeps whole device pixels at a fractional ratio of $dpr', ({ dpr, w, h, scale }) => {
    const viewport = computeViewport(w, h, dpr);
    expect(viewport.scale).toBe(scale);
    expect(viewport.cssWidth * dpr).toBeCloseTo(viewport.deviceWidth, 9);
    expect(Number.isInteger(viewport.deviceWidth)).toBe(true);
  });

  it('never goes below ×1, even in a window smaller than the logical screen', () => {
    expect(computeViewport(300, 200, 1).scale).toBe(1);
  });

  it('scales in device pixels on high-density screens, then sizes the canvas back in CSS pixels', () => {
    const viewport = computeViewport(1440, 900, 2);
    expect(viewport.scale).toBe(5);
    expect(viewport.deviceWidth).toBe(2400);
    expect(viewport.deviceHeight).toBe(1600);
    expect(viewport.cssWidth).toBe(1200);
    expect(viewport.cssHeight).toBe(800);
  });

  it('gives the visible canvas exactly scale × the logical size', () => {
    const viewport = computeViewport(1920, 1080, 1);
    expect(viewport.deviceWidth).toBe(1440);
    expect(viewport.deviceHeight).toBe(960);
  });
});
