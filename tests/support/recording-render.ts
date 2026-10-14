import type { FontId, RenderPort, RenderRegion } from '../../src/domain/ports/render-port';
import { LANDSCAPE } from '../../src/domain/presentation/screen';
import type { ScreenLayout } from '../../src/domain/presentation/screen';

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

const LETTER_A = 0x41;
const LETTER_Z = 0x5a;
const SPACE = 0x20;

/** ← ↑ → ↓ (U+2190 to U+2193), the menu font's arrows (GDD v0.15 §4.2). */
const ARROW_LEFT = 0x2190;
const ARROW_DOWN = 0x2193;

/**
 * The glyph sets of the RenderPort contract: `hud` digits, × and space; `title` A–Z and space;
 * `menu` A–Z, 0–9, space and the four arrows.
 */
function isGlyph(code: number, font: FontId): boolean {
  const letter = (code >= LETTER_A && code <= LETTER_Z) || code === SPACE;
  const digit = code >= ZERO && code <= NINE;
  if (font === 'title') return letter;
  if (font === 'menu') return letter || digit || (code >= ARROW_LEFT && code <= ARROW_DOWN);
  return digit || code === TIMES || code === SPACE;
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
  /** The screen the test draws on; landscape unless a test sets it. */
  screen: ScreenLayout = LANDSCAPE;

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
    for (let i = 0; i < text.length; i += 1) {
      if (!isGlyph(text.codePointAt(i) ?? -1, font)) {
        throw new Error(`no ${font} glyph for "${text}"`);
      }
    }
    this.texts.push({ region: this.region, x, y, text, font });
  }
  layout(): ScreenLayout {
    return this.screen;
  }
  /** The last camera offset set (screen shake). */
  readonly camera = { x: 0, y: 0 };
  setCameraOffset(dx: number, dy: number): void {
    this.camera.x = dx;
    this.camera.y = dy;
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
