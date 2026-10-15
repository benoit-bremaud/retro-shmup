import { SPRITE_IDS } from '../domain/ports/render-port';
import { Palette } from '../domain/presentation/palette';
import type { SpriteId } from '../domain/ports/render-port';
import { CELL_SIZE, SPRITE_CELLS } from './sprite-atlas';

/** The part of `CanvasRenderingContext2D` the bake uses; tests pass a recording double. */
export interface BakeSurface {
  imageSmoothingEnabled: boolean;
  globalCompositeOperation: GlobalCompositeOperation;
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
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

/** A baked sprite, its white flash silhouette, and its size in logical pixels. */
export interface BakedSprite {
  readonly image: CanvasImageSource;
  readonly flash: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

/** The flash colour wherever `image` has a pixel: its own copy, then `source-in` paint. */
function whiteSilhouette(
  image: CanvasImageSource,
  side: number,
  newCanvas: (width: number, height: number) => BakeCanvas,
): CanvasImageSource {
  const canvas = newCanvas(side, side);
  const surface = canvas.surface;
  surface.imageSmoothingEnabled = false;
  surface.drawImage(image, 0, 0, side, side, 0, 0, side, side);
  surface.globalCompositeOperation = 'source-in';
  surface.fillStyle = Palette.hitFlash;
  surface.fillRect(0, 0, side, side);
  return canvas.image;
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
   * neighbour, turned nose up where the cell says so, with a white silhouette of the result for
   * the hit flash. All or nothing: if a canvas fails, the bank
   * stays empty, so a run never mixes sprites and shapes (render/02-sequence-sprite-loading).
   */
  bake(
    ships: CanvasImageSource,
    tiles: CanvasImageSource,
    newCanvas: (width: number, height: number) => BakeCanvas,
  ): void {
    const staged = new Map<SpriteId, BakedSprite>();
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
      const flash = whiteSilhouette(canvas.image, side, newCanvas);
      staged.set(id, { image: canvas.image, flash, width: side, height: side });
    }
    staged.forEach((sprite, id) => this.baked.set(id, sprite));
  }

  get(id: SpriteId): BakedSprite | undefined {
    return this.baked.get(id);
  }
}
