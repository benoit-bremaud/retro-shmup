import { FLAG_SIZE } from '../domain/ports/render-port';
import type { BakeCanvas } from './sprite-bank';
import { FLAG_SHEET_CODES } from './flag-codes';

/** The sheet's cells per row (scripts/build-flag-sheet.py). */
const SHEET_COLUMNS = 16;

/**
 * Territories with no flag file that fly their parent's flag (ADR-0028 decision 3). BV, SJ, HM
 * and UM need none: the set draws them as their parent already.
 */
export const FLAG_ALIASES: Readonly<Record<string, string>> = { BL: 'FR', MF: 'FR', BQ: 'NL' };

/**
 * The country flags ready to draw (ADR-0028): empty until `bake`, so the renderer answers `false`
 * and the caller shows the code alone while the sheet loads, if it never does, or for a code
 * with no flag.
 */
export class FlagBank {
  private readonly baked = new Map<string, CanvasImageSource>();

  /**
   * Copies every cell into its own canvas, once, outside the game loop, then maps the aliases.
   * All or nothing, like `SpriteBank.bake`.
   */
  bake(sheet: CanvasImageSource, newCanvas: (width: number, height: number) => BakeCanvas): void {
    const staged = new Map<string, CanvasImageSource>();
    const { width, height } = FLAG_SIZE;
    for (let i = 0; i < FLAG_SHEET_CODES.length; i += 1) {
      const code = FLAG_SHEET_CODES[i];
      if (code === undefined) continue;
      const canvas = newCanvas(width, height);
      canvas.surface.imageSmoothingEnabled = false;
      const sx = (i % SHEET_COLUMNS) * width;
      const sy = Math.floor(i / SHEET_COLUMNS) * height;
      canvas.surface.drawImage(sheet, sx, sy, width, height, 0, 0, width, height);
      staged.set(code, canvas.image);
    }
    const aliases = Object.keys(FLAG_ALIASES);
    for (let i = 0; i < aliases.length; i += 1) {
      const code = aliases[i];
      const parent = code === undefined ? undefined : staged.get(FLAG_ALIASES[code] ?? '');
      if (code !== undefined && parent !== undefined) staged.set(code, parent);
    }
    staged.forEach((image, code) => this.baked.set(code, image));
  }

  /** The baked flag of `code`, or `undefined` (not baked yet, or no flag): the code alone then. */
  get(code: string): CanvasImageSource | undefined {
    return this.baked.get(code);
  }
}
