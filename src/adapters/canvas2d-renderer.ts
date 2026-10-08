import type { FontId, RenderPort, RenderRegion, SpriteId } from '../domain/ports/render-port';
import { Palette } from '../domain/presentation/palette';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FIELD_X,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '../domain/presentation/screen';
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

  constructor(offscreen: RenderSurface, offscreenImage: CanvasImageSource, visible: RenderSurface) {
    this.offscreen = offscreen;
    this.offscreenImage = offscreenImage;
    this.visible = visible;
  }

  /** Called by the composition root whenever the window or the pixel ratio changes. */
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
    const inField = this.region === 'field';
    const originX = inField ? FIELD_X + this.cameraX : 0;
    const originY = inField ? this.cameraY : 0;
    this.offscreen.fillStyle = colour;
    this.offscreen.fillRect(
      Math.round(originX + x),
      Math.round(originY + y),
      Math.round(w),
      Math.round(h),
    );
  }

  drawText(text: string, _x: number, _y: number, font: FontId): void {
    throw new Error(`Canvas2DRenderer: no bitmap font "${font}" loaded yet, cannot draw "${text}"`);
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
