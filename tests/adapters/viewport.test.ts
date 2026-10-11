import { describe, expect, it } from 'vitest';
import { computeViewport } from '../../src/adapters/viewport';

describe('computeViewport — screen choice (ADR-0014, ADR-0015 decision 1, ADR-0018)', () => {
  it.each([
    { name: '1920 × 1080 @1', w: 1920, h: 1080, dpr: 1, kind: 'landscape', scale: 3 },
    { name: '1280 × 900 @1', w: 1280, h: 900, dpr: 1, kind: 'landscape', scale: 2 },
    { name: 'phone 390 × 844 @3', w: 390, h: 844, dpr: 3, kind: 'portrait', scale: 4 },
    { name: 'phone 844 × 390 @3 (tie)', w: 844, h: 390, dpr: 3, kind: 'landscape', scale: 3 },
    { name: 'tablet 768 × 1024 @2', w: 768, h: 1024, dpr: 2, kind: 'portrait', scale: 5 },
    { name: 'tablet 1024 × 768 @2 (tie)', w: 1024, h: 768, dpr: 2, kind: 'landscape', scale: 4 },
    { name: 'window 390 × 844 @1', w: 390, h: 844, dpr: 1, kind: 'portrait', scale: 1 },
    { name: '200 × 200 @1 (neither fits)', w: 200, h: 200, dpr: 1, kind: 'portrait', scale: 1 },
  ])('chooses $kind ×$scale on $name', ({ w, h, dpr, kind, scale }) => {
    const viewport = computeViewport(w, h, dpr);
    expect(viewport.layout.kind).toBe(kind);
    expect(viewport.scale).toBe(scale);
  });

  it.each([
    { name: '1440p, 16:9', w: 2560, h: 1440, dpr: 1, scale: 4 },
    { name: '16:10 laptop', w: 1680, h: 1050, dpr: 1, scale: 3 },
    { name: '1366 × 768 laptop', w: 1366, h: 768, dpr: 1, scale: 2 },
  ])('keeps an integer landscape scale of $scale on a $name screen', ({ w, h, dpr, scale }) => {
    expect(computeViewport(w, h, dpr)).toMatchObject({ scale, layout: { kind: 'landscape' } });
  });

  it.each([
    { dpr: 1.25, w: 1536, h: 864 },
    { dpr: 1.5, w: 1280, h: 720 },
    { dpr: 1.75, w: 1097, h: 617 },
    { dpr: 3, w: 390, h: 844 },
  ])('keeps whole device pixels at a fractional ratio of $dpr', ({ dpr, w, h }) => {
    const viewport = computeViewport(w, h, dpr);
    expect(viewport.cssWidth * dpr).toBeCloseTo(viewport.deviceWidth, 9);
    expect(Number.isInteger(viewport.deviceWidth)).toBe(true);
    expect(Number.isInteger(viewport.deviceHeight)).toBe(true);
  });

  it('never goes below ×1, even in a window smaller than either screen', () => {
    expect(computeViewport(300, 200, 1).scale).toBe(1);
  });

  it('gives the visible canvas exactly scale × the chosen logical size', () => {
    expect(computeViewport(1920, 1080, 1)).toMatchObject({ deviceWidth: 1440, deviceHeight: 960 });
    expect(computeViewport(390, 844, 3)).toMatchObject({ deviceWidth: 960, deviceHeight: 1408 });
  });

  it('scales in device pixels on high-density screens, then sizes the canvas back in CSS pixels', () => {
    const viewport = computeViewport(1440, 900, 2);
    expect(viewport).toMatchObject({
      scale: 5,
      deviceWidth: 2400,
      deviceHeight: 1600,
      cssWidth: 1200,
      cssHeight: 800,
    });
  });
});
