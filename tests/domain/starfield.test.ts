import { describe, expect, it } from 'vitest';
import { STARFIELD_LAYERS, Starfield } from '../../src/domain/presentation/starfield';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../src/domain/presentation/screen';
import type { RenderPort } from '../../src/domain/ports/render-port';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  colour: string;
}

class RecordingRender implements RenderPort {
  rects: Rect[] = [];
  setRegion(): void {
    /* the caller selects the field */
  }
  clear(): void {
    this.rects = [];
  }
  drawSprite(): void {
    throw new Error('not used');
  }
  drawRect(x: number, y: number, w: number, h: number, colour: string): void {
    this.rects.push({ x, y, w, h, colour });
  }
  drawText(): void {
    throw new Error('not used');
  }
  setCameraOffset(): void {
    /* not used */
  }
  present(): void {
    /* not used */
  }
}

function sequence(): () => number {
  let i = 0;
  return () => {
    i = (i + 0.37) % 1;
    return i;
  };
}

function draw(field: Starfield, timeSeconds: number): Rect[] {
  const render = new RecordingRender();
  field.draw(render, timeSeconds);
  return render.rects;
}

const totalStars = STARFIELD_LAYERS.reduce((sum, layer) => sum + layer.count, 0);

describe('Starfield (ADR-0010: a pure function of scroll time)', () => {
  it('draws every star of every layer inside the play field', () => {
    const rects = draw(new Starfield(sequence()), 12.5);
    expect(rects).toHaveLength(totalStars);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x).toBeLessThan(FIELD_WIDTH);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeLessThan(FIELD_HEIGHT);
    }
  });

  it('gives the same picture for the same time, whatever happened before', () => {
    const field = new Starfield(sequence());
    const first = draw(field, 3.2);
    draw(field, 100);
    expect(draw(field, 3.2)).toEqual(first);
  });

  it('scrolls downward and wraps at the bottom of the field', () => {
    const field = new Starfield(sequence());
    const start = draw(field, 0);
    const later = draw(field, 0.1);
    const slowest = STARFIELD_LAYERS[0];
    if (slowest === undefined) throw new Error('no layer');
    const firstStar = start[0];
    const movedStar = later[0];
    if (firstStar === undefined || movedStar === undefined) throw new Error('no star');
    const expected = (firstStar.y + slowest.speed * 0.1) % FIELD_HEIGHT;
    expect(movedStar.y).toBeCloseTo(expected, 5);
    expect(movedStar.x).toBe(firstStar.x);
  });

  it('moves nearer layers faster (parallax)', () => {
    const speeds = STARFIELD_LAYERS.map((layer) => layer.speed);
    expect([...speeds].sort((a, b) => a - b)).toEqual(speeds);
    expect(new Set(speeds).size).toBe(speeds.length);
  });

  it('draws the stars from a fixed table built once, using the injected randomness only', () => {
    let calls = 0;
    const field = new Starfield(() => {
      calls += 1;
      return 0.5;
    });
    const afterConstruction = calls;
    draw(field, 1);
    draw(field, 2);
    expect(afterConstruction).toBe(totalStars * 2);
    expect(calls).toBe(afterConstruction);
  });
});
