import { HUD_FONT_CELL, TITLE_FONT_CELL } from '../domain/ports/render-port';
import type { FontId, RenderPort, RenderRegion, SpriteId } from '../domain/ports/render-port';
import { Palette } from '../domain/presentation/palette';
import { FIELD_HEIGHT, FIELD_WIDTH, LANDSCAPE } from '../domain/presentation/screen';
import type { ScreenLayout } from '../domain/presentation/screen';
import { GLYPH_COLUMNS, GLYPH_ROWS, hudGlyph, titleGlyph } from './hud-font';
import type { Viewport } from './viewport';

// Logical pixels per glyph pixel: HUD_FONT_CELL and TITLE_FONT_CELL are built on them.
const HUD_SCALE = 2;
const TITLE_SCALE = 4;

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
 * `drawText` draws the placeholder `hud` and `title` glyphs and fails closed on anything else.
 */
export class Canvas2DRenderer implements RenderPort {
  private region: RenderRegion = 'hud';
  private cameraX = 0;
  private cameraY = 0;
  private layoutNow: ScreenLayout = LANDSCAPE;
  private deviceWidth = LANDSCAPE.width;
  private deviceHeight = LANDSCAPE.height;
  private readonly offscreen: RenderSurface;
  private readonly offscreenImage: CanvasImageSource;
  private readonly visible: RenderSurface;

  /** `offscreenImage` is the canvas behind `offscreen`, copied to `visible` by `present()`. */
  constructor(offscreen: RenderSurface, offscreenImage: CanvasImageSource, visible: RenderSurface) {
    this.offscreen = offscreen;
    this.offscreenImage = offscreenImage;
    this.visible = visible;
  }

  /**
   * Called by the composition root after it resized both canvases (ADR-0018 decision 6). Resizing
   * a canvas resets its context, clip included, so the region goes back to `hud` without a
   * `restore()`, and the camera to (0, 0).
   */
  resize(viewport: Viewport): void {
    this.layoutNow = viewport.layout;
    this.deviceWidth = viewport.deviceWidth;
    this.deviceHeight = viewport.deviceHeight;
    this.region = 'hud';
    this.cameraX = 0;
    this.cameraY = 0;
  }

  layout(): ScreenLayout {
    return this.layoutNow;
  }

  setRegion(region: RenderRegion): void {
    if (region === this.region) return;
    if (region === 'field') {
      this.offscreen.save();
      this.offscreen.beginPath();
      this.offscreen.rect(this.layoutNow.fieldX, this.layoutNow.fieldY, FIELD_WIDTH, FIELD_HEIGHT);
      this.offscreen.clip();
    } else {
      this.offscreen.restore();
    }
    this.region = region;
  }

  clear(): void {
    this.setRegion('hud');
    this.offscreen.fillStyle = Palette.background;
    this.offscreen.fillRect(0, 0, this.layoutNow.width, this.layoutNow.height);
  }

  drawSprite(id: SpriteId, _x: number, _y: number): void {
    throw new Error(`Canvas2DRenderer: no sprite sheet loaded yet, cannot draw sprite "${id}"`);
  }

  drawRect(x: number, y: number, w: number, h: number, colour: string): void {
    this.offscreen.fillStyle = colour;
    this.fillLogical(x, y, w, h);
  }

  drawText(text: string, x: number, y: number, font: FontId): void {
    const title = font === 'title';
    const scale = title ? TITLE_SCALE : HUD_SCALE;
    const advance = title ? TITLE_FONT_CELL.width : HUD_FONT_CELL.width;
    this.offscreen.fillStyle = title ? Palette.titleText : Palette.hudText;
    const glyphOf = title ? titleGlyph : hudGlyph;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.codePointAt(i);
      const rows = code === undefined ? undefined : glyphOf(code);
      if (rows === undefined) {
        throw new Error(`Canvas2DRenderer: no ${font} glyph for "${text.charAt(i)}" in "${text}"`);
      }
      this.drawGlyph(rows, x + i * advance, y, scale);
    }
  }

  // One block per lit glyph pixel, through the same origin and rounding as drawRect.
  private drawGlyph(rows: readonly number[], x: number, y: number, scale: number): void {
    for (let row = 0; row < GLYPH_ROWS; row += 1) {
      const mask = rows[row] ?? 0;
      for (let column = 0; column < GLYPH_COLUMNS; column += 1) {
        if ((mask & (1 << (GLYPH_COLUMNS - 1 - column))) === 0) continue;
        this.fillLogical(x + column * scale, y + row * scale, scale, scale);
      }
    }
  }

  // Region origin, camera offset for the field, whole logical pixels.
  private fillLogical(x: number, y: number, w: number, h: number): void {
    const inField = this.region === 'field';
    const originX = inField ? this.layoutNow.fieldX + this.cameraX : 0;
    const originY = inField ? this.layoutNow.fieldY + this.cameraY : 0;
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
