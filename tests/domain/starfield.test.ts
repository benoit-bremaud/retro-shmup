import { describe, expect, it } from 'vitest';
import { STARFIELD_LAYERS, Starfield } from '../../src/domain/presentation/starfield';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../src/domain/presentation/screen';
import type { RenderPort } from '../../src/domain/ports/render-port';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

class RecordingRender implements RenderPort {
  rects: Rect[] = [];
  setRegion(): void {
    // The caller selects the field.
  }
  clear(): void {
    this.rects = [];
  }
  drawSprite(): void {
    throw new Error('not used');
  }
  drawRect(x: number, y: number, w: number, h: number): void {
    this.rects.push({ x, y, w, h });
  }
  drawText(): void {
    throw new Error('not used');
  }
  setCameraOffset(): void {
    // Not used.
  }
  present(): void {
    // Not used.
  }
}

/** A deterministic stand-in for the unseeded presentation randomness. */
function sequence(): () => number {
  let value = 0;
  return () => {
    value = (value + 0.37) % 1;
    return value;
  };
}

function draw(field: Starfield, timeSeconds: number): Rect[] {
  const render = new RecordingRender();
  field.draw(render, timeSeconds);
  return render.rects;
}

/** Index of the first star of each layer in the drawing order. */
const layerStarts = STARFIELD_LAYERS.map((_, layer) =>
  STARFIELD_LAYERS.slice(0, layer).reduce((sum, previous) => sum + previous.count, 0),
);
const totalStars = STARFIELD_LAYERS.reduce((sum, layer) => sum + layer.count, 0);

describe('Starfield (ADR-0010: a pure function of scroll time)', () => {
  it('draws every star of every layer entirely inside the play field', () => {
    const rects = draw(new Starfield(sequence()), 12.5);
    expect(rects).toHaveLength(totalStars);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(FIELD_WIDTH);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeLessThan(FIELD_HEIGHT);
    }
  });

  it('gives the same picture for the same time, whatever was drawn before', () => {
    const field = new Starfield(sequence());
    const first = draw(field, 3.2);
    draw(field, 100);
    expect(draw(field, 3.2)).toEqual(first);
  });

  it('scrolls downward and wraps from the bottom back to the top', () => {
    const field = new Starfield(() => 0.5);
    const slowest = STARFIELD_LAYERS[0];
    if (slowest === undefined) throw new Error('no layer');
    const start = draw(field, 0)[0];
    const crossing = (FIELD_HEIGHT - 160 + 10) / slowest.speed;
    const wrapped = draw(field, crossing)[0];
    expect(start?.y).toBeCloseTo(160, 4);
    expect(wrapped?.y).toBeCloseTo(10, 4);
  });

  it('stays inside the field for a negative time', () => {
    for (const rect of draw(new Starfield(sequence()), -7.3)) {
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeLessThan(FIELD_HEIGHT);
    }
  });

  it('moves nearer layers faster (parallax), measured on the drawn stars', () => {
    const field = new Starfield(() => 0.5);
    const before = draw(field, 0);
    const after = draw(field, 0.5);
    const displacement = layerStarts.map(
      (index) => (after[index]?.y ?? 0) - (before[index]?.y ?? 0),
    );
    expect(displacement.every((d, i) => i === 0 || d > (displacement[i - 1] ?? 0))).toBe(true);
  });

  it('builds its star table once and never draws randomness while rendering', () => {
    let calls = 0;
    const field = new Starfield(() => {
      calls += 1;
      return 0.5;
    });
    const afterConstruction = calls;
    draw(field, 1);
    draw(field, 2);
    expect(calls).toBe(afterConstruction);
  });
});
