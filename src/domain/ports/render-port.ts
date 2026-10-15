import type { ScreenLayout } from '../presentation/screen';

/**
 * Every sprite the presentation draws (GDD v0.17 §3.2.1, ADR-0001 amendment): a closed list, so an
 * unknown id does not compile and the adapter's cell table is checked for completeness.
 */
export const SPRITE_IDS = [
  'player',
  'popcorn',
  'diver',
  'gunner',
  'carrier',
  'heavy',
  'cruiserHull',
  'cruiserWing',
  'cruiserTurret',
] as const;

/**
 * The `frame` of `drawSprite` that draws the sprite's white silhouette: the hit flash of GDD v0.17
 * §3.2.1 and §9.4, baked once at load like the sprite (ADR-0001 amendment).
 */
export const SPRITE_FLASH_FRAME = 1;

/** Key of a sprite (ADR-0001 amendment). */
export type SpriteId = (typeof SPRITE_IDS)[number];

/**
 * Bitmap fonts; no system text is ever drawn (ADR-0001). A font draws only its glyph set and
 * throws on any other character: `hud` is `0`–`9`, `×` (U+00D7) and the
 * space (an empty cell, ADR-0022 decision 8), `title` is `A`–`Z` and the
 * space, `menu` the same plus `0`–`9`, the arrows ← ↑ → ↓ (U+2190–U+2193, GDD v0.15 §4.2), `?` and `-` (v0.16);
 * French text is written in capitals without accents, arcade style, until the bitmap fonts of
 * the screens brick.
 */
export type FontId = 'hud' | 'title' | 'menu';

/**
 * Cell of the `hud` font in logical pixels: 3 × 5 glyphs drawn 2× (`glyphWidth` × 10) plus a 2 px
 * advance.
 * The domain uses it to align and centre text; every `RenderPort` honours it.
 */
export const HUD_FONT_CELL = { width: 8, height: 10, glyphWidth: 6 } as const;

/**
 * Cell of the `menu` font: the `title` glyphs drawn 2×, in the `hud` cell, so a menu row of 28
 * characters fits the 240 px field (GDD v0.13 §9.1).
 */
export const MENU_FONT_CELL = { width: 8, height: 10, glyphWidth: 6 } as const;

/** Cell of the `title` font: the same 3 × 5 glyphs drawn 4× (12 × 20) plus a 4 px advance. */
export const TITLE_FONT_CELL = { width: 16, height: 20, glyphWidth: 12 } as const;

/**
 * Coordinate space of the next draw calls: the 240 × 320 play field, or `hud`, the whole logical
 * screen (ADR-0010, ADR-0018 decision 1).
 */
export type RenderRegion = 'field' | 'hud';

/**
 * Drawing surface of the game (ADR-0001). Coordinates are in pixels of the selected region;
 * the adapter applies the integer scale. Methods are added only when a second caller needs them.
 */
export interface RenderPort {
  setRegion(region: RenderRegion): void;
  clear(): void;
  /**
   * Draws the sprite centred on (x, y) in the selected region — unlike `drawRect` and `drawText`,
   * whose (x, y) is the top-left — field draws following the camera offset. `frame` is 0 (the
   * default) for the sprite, `SPRITE_FLASH_FRAME` for its white flash silhouette.
   * @returns `true` when drawn; `false` while the sprite sheets are not loaded (still loading, or a
   * load failed), the caller then drawing its own placeholder shape (ADR-0001 amendment).
   */
  drawSprite(id: SpriteId, x: number, y: number, frame?: number, flipX?: boolean): boolean;
  drawRect(x: number, y: number, w: number, h: number, colour: string): void;
  /**
   * Draws `text` with the top-left of its first cell at (x, y) in the selected region, in the
   * font's colour; field text follows the camera offset like any field draw.
   * @throws Error on a character outside the font's glyph set, or a font with no glyph.
   */
  drawText(text: string, x: number, y: number, font: FontId): void;
  /** The logical screen being drawn (ADR-0015 decision 3); read by scenes and presenters only. */
  layout(): ScreenLayout;
  /** Screen shake; (0, 0) when the effect is disabled. */
  setCameraOffset(dx: number, dy: number): void;
  /** Copies the off-screen canvas to the visible one. */
  present(): void;
}
