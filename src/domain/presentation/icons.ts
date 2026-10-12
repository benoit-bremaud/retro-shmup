import type { RenderPort } from '../ports/render-port';

/**
 * The player-kit shapes (GDD v0.8 §9.2, meta/05-state-scenes player-kit additions), drawn in a
 * `size` × `size` box from its top-left corner: 8 for the HUD icons, 16 for the pickups on the
 * field. Kinds differ by shape, never by colour only (GDD §9.7). Allocates nothing.
 */

/** A small ship: a vertical hull and a wing bar across its lower half. */
export function drawShipIcon(
  r: RenderPort,
  x: number,
  y: number,
  size: number,
  colour: string,
): void {
  const t = size / 4;
  r.drawRect(x + (size - t) / 2, y, t, size, colour);
  r.drawRect(x, y + (size * 5) / 8, size, t, colour);
}

/** A plus sign, centred: the bomb. */
export function drawPlusIcon(
  r: RenderPort,
  x: number,
  y: number,
  size: number,
  colour: string,
): void {
  const t = size / 4;
  r.drawRect(x + (size - t) / 2, y, t, size, colour);
  r.drawRect(x, y + (size - t) / 2, size, t, colour);
}

/** A hollow square: the shield. */
export function drawHollowSquare(
  r: RenderPort,
  x: number,
  y: number,
  size: number,
  colour: string,
): void {
  const t = size / 8;
  r.drawRect(x, y, size, t, colour);
  r.drawRect(x, y + size - t, size, t, colour);
  r.drawRect(x, y + t, t, size - 2 * t, colour);
  r.drawRect(x + size - t, y + t, t, size - 2 * t, colour);
}
