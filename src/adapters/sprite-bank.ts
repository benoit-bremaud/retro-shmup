import { SPRITE_IDS } from '../domain/ports/render-port';
import type { SpriteId } from '../domain/ports/render-port';
import { CELL_SIZE, SPRITE_CELLS } from './sprite-atlas';

/** The part of `CanvasRenderingContext2D` the bake uses; tests pass a recording double. */
export interface BakeSurface {
  imageSmoothingEnabled: boolean;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
}

/** An off-screen canvas made for one sprite: its context and the canvas itself, to draw from. */
export interface BakeCanvas {
  readonly surface: BakeSurface;
  readonly image: CanvasImageSource;
}

/** A baked sprite and its size in logical pixels. */
export interface BakedSprite {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

/**
 * The sprites ready to draw (ADR-0001 amendment): empty until `bake`, so the renderer answers
 * `false` and the presentation keeps its shapes while the sheets load or if they never do.
 */
export class SpriteBank {
  // A Map, not a Record: an id has no entry until the bake.
  private readonly baked = new Map<SpriteId, BakedSprite>();

  /**
   * Copies every cell into its own canvas, once, outside the game loop: scaled with nearest
   * neighbour, turned nose up where the cell says so.
   */
  bake(
    ships: CanvasImageSource,
    tiles: CanvasImageSource,
    newCanvas: (width: number, height: number) => BakeCanvas,
  ): void {
    for (let i = 0; i < SPRITE_IDS.length; i += 1) {
      const id = SPRITE_IDS[i];
      if (id === undefined) continue;
      const cell = SPRITE_CELLS[id];
      const size = CELL_SIZE[cell.sheet];
      const side = size * cell.scale;
      const canvas = newCanvas(side, side);
      const surface = canvas.surface;
      surface.imageSmoothingEnabled = false;
      if (cell.flipY) {
        surface.translate(0, side);
        surface.scale(1, -1);
      }
      const sheet = cell.sheet === 'ships' ? ships : tiles;
      surface.drawImage(sheet, cell.column * size, cell.row * size, size, size, 0, 0, side, side);
      this.baked.set(id, { image: canvas.image, width: side, height: side });
    }
  }

  get(id: SpriteId): BakedSprite | undefined {
    return this.baked.get(id);
  }
}
