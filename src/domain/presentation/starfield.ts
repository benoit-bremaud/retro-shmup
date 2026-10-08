import type { RenderPort } from '../ports/render-port';
import { Palette } from './palette';
import type { PaletteColour } from './palette';
import { FIELD_HEIGHT, FIELD_WIDTH } from './screen';

interface StarLayer {
  readonly count: number;
  /** Scroll speed in play-field pixels per second. */
  readonly speed: number;
  readonly size: number;
  readonly colour: PaletteColour;
}

/** Far to near: nearer layers are faster, bigger and brighter (parallax). */
export const STARFIELD_LAYERS: readonly StarLayer[] = [
  { count: 40, speed: 12, size: 1, colour: Palette.starFar },
  { count: 24, speed: 30, size: 1, colour: Palette.starMid },
  { count: 10, speed: 70, size: 2, colour: Palette.starNear },
];

/**
 * Scrolling background of the play field. Star positions are a pure function of the scroll time
 * (ADR-0010): the table is drawn once from the injected, unseeded presentation randomness, so the
 * gameplay `Random` is never consumed and drawing allocates nothing.
 */
export class Starfield {
  private readonly xs: Float32Array;
  private readonly ys: Float32Array;

  constructor(random: () => number) {
    const total = STARFIELD_LAYERS.reduce((sum, layer) => sum + layer.count, 0);
    this.xs = new Float32Array(total);
    this.ys = new Float32Array(total);
    let i = 0;
    for (const layer of STARFIELD_LAYERS) {
      for (let n = 0; n < layer.count; n += 1) {
        this.xs[i] = Math.floor(random() * (FIELD_WIDTH - layer.size));
        this.ys[i] = random() * FIELD_HEIGHT;
        i += 1;
      }
    }
  }

  /** Draws in the current region, which the caller sets to the play field. */
  draw(render: RenderPort, timeSeconds: number): void {
    let i = 0;
    for (const layer of STARFIELD_LAYERS) {
      const offset = layer.speed * timeSeconds;
      for (let n = 0; n < layer.count; n += 1) {
        const y = ((((this.ys[i] ?? 0) + offset) % FIELD_HEIGHT) + FIELD_HEIGHT) % FIELD_HEIGHT;
        render.drawRect(this.xs[i] ?? 0, y, layer.size, layer.size, layer.colour);
        i += 1;
      }
    }
  }
}
