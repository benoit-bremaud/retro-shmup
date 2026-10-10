/** Key of a sprite in the loaded sprite sheets (ADR-0001). */
export type SpriteId = string;

/**
 * Bitmap fonts; no system text is ever drawn (ADR-0001). A font draws only its glyph set and
 * throws on any other character: `hud` is `0`–`9` and `×` (U+00D7), `title` is `A`–`Z` and the
 * space, until the bitmap fonts of the screens brick.
 */
export type FontId = 'hud' | 'title';

/**
 * Cell of the `hud` font in logical pixels: 3 × 5 glyphs drawn 2× (`glyphWidth` × 10) plus a 2 px
 * advance.
 * The domain uses it to align and centre text; every `RenderPort` honours it.
 */
export const HUD_FONT_CELL = { width: 8, height: 10, glyphWidth: 6 } as const;

/** Cell of the `title` font: the same 3 × 5 glyphs drawn 4× (12 × 20) plus a 4 px advance. */
export const TITLE_FONT_CELL = { width: 16, height: 20, glyphWidth: 12 } as const;

/** Coordinate space of the next draw calls: the 240 × 320 play field or the HUD bands (ADR-0010). */
export type RenderRegion = 'field' | 'hud';

/**
 * Drawing surface of the game (ADR-0001). Coordinates are in pixels of the selected region;
 * the adapter applies the integer scale. Methods are added only when a second caller needs them.
 */
export interface RenderPort {
  setRegion(region: RenderRegion): void;
  clear(): void;
  drawSprite(id: SpriteId, x: number, y: number, frame?: number, flipX?: boolean): void;
  drawRect(x: number, y: number, w: number, h: number, colour: string): void;
  /**
   * Draws `text` with the top-left of its first cell at (x, y) in the selected region, in the
   * font's colour; field text follows the camera offset like any field draw.
   * @throws Error on a character outside the font's glyph set, or a font with no glyph.
   */
  drawText(text: string, x: number, y: number, font: FontId): void;
  /** Screen shake; (0, 0) when the effect is disabled. */
  setCameraOffset(dx: number, dy: number): void;
  /** Copies the off-screen canvas to the visible one. */
  present(): void;
}
