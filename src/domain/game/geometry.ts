/** The play field in play-field pixels (ADR-0014): a gameplay fact the screen layout reuses. */
export const FIELD_WIDTH = 240;
/** Height of the play field; ADR-0014 fixes it, the portrait and landscape layouts reuse it. */
export const FIELD_HEIGHT = 320;

/** A mutable point, updated in place so a step allocates nothing (ADR-0002). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Anything with a centre and a size: bullets, enemies, hitboxes. */
export interface Box {
  readonly position: Readonly<Vec2>;
  readonly width: number;
  readonly height: number;
}

/**
 * Whether a box centred on (x, y) overlaps the play field; touching an edge is outside. One rule
 * for the release of departed bodies and the script's load checks.
 */
export function overlapsField(x: number, y: number, width: number, height: number): boolean {
  return (
    x + width / 2 > 0 &&
    x - width / 2 < FIELD_WIDTH &&
    y + height / 2 > 0 &&
    y - height / 2 < FIELD_HEIGHT
  );
}
