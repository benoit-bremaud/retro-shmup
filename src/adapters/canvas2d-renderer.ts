import { HUD_FONT_CELL } from '../domain/ports/render-port';
import type { FontId, RenderPort, RenderRegion, SpriteId } from '../domain/ports/render-port';
import { Palette } from '../domain/presentation/palette';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FIELD_X,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '../domain/presentation/screen';
import { HUD_GLYPH_COLUMNS, HUD_GLYPH_ROWS, HUD_GLYPH_SCALE, hudGlyph } from './hud-font';
import type { Viewport } from './viewport';

/**
 * The part of `CanvasRenderingContext2D` the renderer uses; a real context satisfies it, and tests
 * pass a recording double (ADR-0011: adapter tests run in Node with injected browser doubles).
 */
export interface RenderSurface {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, w: number, h: number): void;
  save(): void;
  restore(): void;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  clip(): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

/**
 * Canvas 2D implementation of `RenderPort` (ADR-0001, ADR-0010, ADR-0014): draws at whole logical
 * pixels into a 480 × 320 off-screen surface, then copies it to the visible canvas scaled by an
 * integer factor with smoothing off.
 *
 * @remarks The camera offset (screen shake) moves field-region draws only, at draw time: the HUD
 * never shakes (ADR-0014). `drawSprite` fails closed until the asset brick loads a sprite sheet;
 * `drawText` draws the `hud` digits from its own glyph table and fails closed on anything else.
 */
export class Canvas2DRenderer implements RenderPort {
  private region: RenderRegion = 'hud';
  private cameraX = 0;
  private cameraY = 0;
  private deviceWidth = SCREEN_WIDTH;
  private deviceHeight = SCREEN_HEIGHT;
  private readonly offscreen: RenderSurface;
  private readonly offscreenImage: CanvasImageSource;
  private readonly visible: RenderSurface;

  /** `offscreenImage` is the canvas behind `offscreen`, copied to `visible` by `present()`. */
  constructor(offscreen: RenderSurface, offscreenImage: CanvasImageSource, visible: RenderSurface) {
    this.offscreen = offscreen;
    this.offscreenImage = offscreenImage;
    this.visible = visible;
  }

  /** Called by the composition root when the window is resized. */
  resize(viewport: Viewport): void {
    this.deviceWidth = viewport.deviceWidth;
    this.deviceHeight = viewport.deviceHeight;
  }

  setRegion(region: RenderRegion): void {
    if (region === this.region) return;
    if (region === 'field') {
      this.offscreen.save();
      this.offscreen.beginPath();
      this.offscreen.rect(FIELD_X, 0, FIELD_WIDTH, FIELD_HEIGHT);
      this.offscreen.clip();
    } else {
      this.offscreen.restore();
    }
    this.region = region;
  }

  clear(): void {
    this.setRegion('hud');
    this.offscreen.fillStyle = Palette.background;
    this.offscreen.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  drawSprite(id: SpriteId, _x: number, _y: number): void {
    throw new Error(`Canvas2DRenderer: no sprite sheet loaded yet, cannot draw sprite "${id}"`);
  }

  drawRect(x: number, y: number, w: number, h: number, colour: string): void {
    this.offscreen.fillStyle = colour;
    this.fillLogical(x, y, w, h);
  }

  drawText(text: string, x: number, y: number, font: FontId): void {
    if (font !== 'hud') {
      throw new Error(
        `Canvas2DRenderer: no bitmap font "${font}" loaded yet, cannot draw "${text}"`,
      );
    }
    this.offscreen.fillStyle = Palette.hudText;
    for (let i = 0; i < text.length; i += 1) {
      const rows = hudGlyph(text.charCodeAt(i));
      if (rows === undefined) {
        throw new Error(`Canvas2DRenderer: no hud glyph for "${text.charAt(i)}" in "${text}"`);
      }
      this.drawGlyph(rows, x + i * HUD_FONT_CELL.width, y);
    }
  }

  // One 2 × 2 block per lit glyph pixel, through the same origin and rounding as drawRect.
  private drawGlyph(rows: readonly number[], x: number, y: number): void {
    for (let row = 0; row < HUD_GLYPH_ROWS; row += 1) {
      const mask = rows[row] ?? 0;
      for (let column = 0; column < HUD_GLYPH_COLUMNS; column += 1) {
        if ((mask & (1 << (HUD_GLYPH_COLUMNS - 1 - column))) === 0) continue;
        this.fillLogical(
          x + column * HUD_GLYPH_SCALE,
          y + row * HUD_GLYPH_SCALE,
          HUD_GLYPH_SCALE,
          HUD_GLYPH_SCALE,
        );
      }
    }
  }

  // Region origin, camera offset for the field, whole logical pixels.
  private fillLogical(x: number, y: number, w: number, h: number): void {
    const inField = this.region === 'field';
    const originX = inField ? FIELD_X + this.cameraX : 0;
    const originY = inField ? this.cameraY : 0;
    this.offscreen.fillRect(
      Math.round(originX + x),
      Math.round(originY + y),
      Math.round(w),
      Math.round(h),
    );
  }

  setCameraOffset(dx: number, dy: number): void {
    this.cameraX = dx;
    this.cameraY = dy;
  }

  present(): void {
    this.setRegion('hud');
    this.visible.imageSmoothingEnabled = false;
    this.visible.drawImage(this.offscreenImage, 0, 0, this.deviceWidth, this.deviceHeight);
  }
}
