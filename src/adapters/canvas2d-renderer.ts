import { HUD_FONT_CELL, MENU_FONT_CELL, TITLE_FONT_CELL } from '../domain/ports/render-port';
import type { FontId, RenderPort, RenderRegion, SpriteId } from '../domain/ports/render-port';
import { Palette } from '../domain/presentation/palette';
import { FIELD_HEIGHT, FIELD_WIDTH, LANDSCAPE } from '../domain/presentation/screen';
import type { ScreenLayout } from '../domain/presentation/screen';
import { GLYPH_COLUMNS, GLYPH_ROWS, hudGlyph, menuGlyph, titleGlyph } from './hud-font';
import type { SpriteBank } from './sprite-bank';
import type { Viewport } from './viewport';

// Logical pixels per glyph pixel: HUD_FONT_CELL and TITLE_FONT_CELL are built on them.
const HUD_SCALE = 2;
const TITLE_SCALE = 4;
/**
 * Each font's cell, scale, glyph set and colour (RenderPort contract), read per draw without
 * building anything: the menu font is the title letters, the digits and four arrows at the hud
 * scale.
 */
const FONTS = {
  hud: { cell: HUD_FONT_CELL, scale: HUD_SCALE, glyph: hudGlyph, colour: Palette.hudText },
  title: {
    cell: TITLE_FONT_CELL,
    scale: TITLE_SCALE,
    glyph: titleGlyph,
    colour: Palette.titleText,
  },
  menu: { cell: MENU_FONT_CELL, scale: HUD_SCALE, glyph: menuGlyph, colour: Palette.titleText },
} as const;

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
 * pixels into the off-screen surface of the current logical screen (480 × 320 landscape or
 * 240 × 352 portrait, ADR-0015), then copies it to the visible canvas scaled by an
 * integer factor with smoothing off.
 *
 * @remarks The camera offset (screen shake) moves field-region draws only, at draw time: the HUD
 * never shakes (ADR-0014). `drawSprite` draws the baked sprites of `SpriteBank` and answers `false`
 * until they are baked (ADR-0001 amendment); `drawText` draws the placeholder `hud`, `title` and `menu` glyphs and fails closed on anything else.
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
  private readonly sprites: SpriteBank;

  /**
   * `offscreenImage` is the canvas behind `offscreen`, copied to `visible` by `present()`;
   * `sprites` fills in once the sheets are loaded, after the first frames.
   */
  constructor(
    offscreen: RenderSurface,
    offscreenImage: CanvasImageSource,
    visible: RenderSurface,
    sprites: SpriteBank,
  ) {
    this.offscreen = offscreen;
    this.offscreenImage = offscreenImage;
    this.visible = visible;
    this.sprites = sprites;
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

  drawSprite(id: SpriteId, x: number, y: number): boolean {
    const sprite = this.sprites.get(id);
    if (sprite === undefined) return false;
    const { width, height } = sprite;
    this.offscreen.drawImage(
      sprite.image,
      Math.round(this.originX() + x - width / 2),
      Math.round(this.originY() + y - height / 2),
      width,
      height,
    );
    return true;
  }

  drawRect(x: number, y: number, w: number, h: number, colour: string): void {
    this.offscreen.fillStyle = colour;
    this.fillLogical(x, y, w, h);
  }

  drawText(text: string, x: number, y: number, font: FontId): void {
    const { cell, scale, glyph, colour } = FONTS[font];
    this.offscreen.fillStyle = colour;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.codePointAt(i);
      const rows = code === undefined ? undefined : glyph(code);
      if (rows === undefined) {
        throw new Error(`Canvas2DRenderer: no ${font} glyph for "${text.charAt(i)}" in "${text}"`);
      }
      this.drawGlyph(rows, x + i * cell.width, y, scale);
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
    this.offscreen.fillRect(
      Math.round(this.originX() + x),
      Math.round(this.originY() + y),
      Math.round(w),
      Math.round(h),
    );
  }

  // The selected region's origin on the logical screen, the camera offset included for the field.
  private originX(): number {
    return this.region === 'field' ? this.layoutNow.fieldX + this.cameraX : 0;
  }

  private originY(): number {
    return this.region === 'field' ? this.layoutNow.fieldY + this.cameraY : 0;
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
