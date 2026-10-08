/** Key of a sprite in the loaded sprite sheets (ADR-0001). */
export type SpriteId = string;

/** Bitmap fonts; no system text is ever drawn (ADR-0001). */
export type FontId = 'hud' | 'title';

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
  drawText(text: string, x: number, y: number, font: FontId): void;
  /** Screen shake; (0, 0) when the effect is disabled. */
  setCameraOffset(dx: number, dy: number): void;
  /** Copies the off-screen canvas to the visible one. */
  present(): void;
}
