import type { FontId, RenderPort, RenderRegion } from '../../src/domain/ports/render-port';

/** A rectangle drawn through the port, with the region it was drawn in. */
export interface RecordedRect {
  region: RenderRegion;
  x: number;
  y: number;
  w: number;
  h: number;
  colour: string;
}

/** A text drawn through the port, with the region it was drawn in. */
export interface RecordedText {
  region: RenderRegion;
  x: number;
  y: number;
  text: string;
  font: FontId;
}

const ZERO = 0x30;
const NINE = 0x39;
const TIMES = 0xd7;

/** The `hud` glyph set of the RenderPort contract: digits and the multiplication sign. */
function isHudGlyph(code: number): boolean {
  return (code >= ZERO && code <= NINE) || code === TIMES;
}

/**
 * The render port test double shared by the domain tests (ADR-0003: render is mocked at its port).
 * It records rectangles per region and counts presented frames; `clear` forgets the frame.
 */
export class RecordingRender implements RenderPort {
  region: RenderRegion = 'hud';
  readonly rects: RecordedRect[] = [];
  readonly texts: RecordedText[] = [];
  presented = 0;

  setRegion(region: RenderRegion): void {
    this.region = region;
  }
  clear(): void {
    this.rects.length = 0;
    this.texts.length = 0;
  }
  drawSprite(): void {
    throw new Error('no sprite before the assets brick');
  }
  drawRect(x: number, y: number, w: number, h: number, colour: string): void {
    this.rects.push({ region: this.region, x, y, w, h, colour });
  }
  /** Honours the RenderPort glyph contract, so domain tests fail like the real renderer. */
  drawText(text: string, x: number, y: number, font: FontId): void {
    if (font !== 'hud') throw new Error(`no glyph in font ${font}`);
    for (let i = 0; i < text.length; i += 1) {
      if (!isHudGlyph(text.charCodeAt(i))) throw new Error(`no hud glyph for "${text}"`);
    }
    this.texts.push({ region: this.region, x, y, text, font });
  }
  setCameraOffset(): void {
    // No test reads the camera yet.
  }
  present(): void {
    this.presented += 1;
  }

  drew(colour: string): boolean {
    return this.rects.some((rect) => rect.colour === colour);
  }
  rectsOf(colour: string): RecordedRect[] {
    return this.rects.filter((rect) => rect.colour === colour);
  }
}
