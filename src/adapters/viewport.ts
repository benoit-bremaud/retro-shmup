import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../domain/presentation/screen';

/** How the 480 × 320 logical screen maps onto the window (ADR-0014). */
export interface Viewport {
  /** Integer factor, in device pixels per logical pixel. */
  readonly scale: number;
  readonly deviceWidth: number;
  readonly deviceHeight: number;
  /** CSS size of the visible canvas: the device size divided by the pixel ratio. */
  readonly cssWidth: number;
  readonly cssHeight: number;
}

/** Largest integer scale that fits the window, computed in device pixels, never below ×1. */
export function computeViewport(cssWidth: number, cssHeight: number, pixelRatio: number): Viewport {
  const scale = Math.max(
    1,
    Math.floor(
      Math.min((cssWidth * pixelRatio) / SCREEN_WIDTH, (cssHeight * pixelRatio) / SCREEN_HEIGHT),
    ),
  );
  const deviceWidth = SCREEN_WIDTH * scale;
  const deviceHeight = SCREEN_HEIGHT * scale;
  return {
    scale,
    deviceWidth,
    deviceHeight,
    cssWidth: deviceWidth / pixelRatio,
    cssHeight: deviceHeight / pixelRatio,
  };
}
