/** The play field in play-field pixels (ADR-0014): a gameplay fact the screen layout reuses. */
export const FIELD_WIDTH = 240;
export const FIELD_HEIGHT = 320;

/** A mutable point, updated in place so a step allocates nothing (ADR-0002). */
export interface Vec2 {
  x: number;
  y: number;
}
