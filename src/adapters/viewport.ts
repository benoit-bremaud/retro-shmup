import { LANDSCAPE, PORTRAIT } from '../domain/presentation/screen';
import type { ScreenLayout } from '../domain/presentation/screen';

/** How the chosen logical screen maps onto the window (ADR-0014, ADR-0015, ADR-0018). */
export interface Viewport {
  /** The logical screen chosen for this window. */
  readonly layout: ScreenLayout;
  /** Integer factor, in device pixels per logical pixel. */
  readonly scale: number;
  readonly deviceWidth: number;
  readonly deviceHeight: number;
  /** CSS size of the visible canvas: the device size divided by the pixel ratio. */
  readonly cssWidth: number;
  readonly cssHeight: number;
}

/** The scale at which `layout` fills the window, before rounding, in device pixels. */
function unclampedScale(layout: ScreenLayout, deviceWidth: number, deviceHeight: number): number {
  return Math.min(deviceWidth / layout.width, deviceHeight / layout.height);
}

// The larger integer scale among the screens that fit, landscape on a tie; else the larger
// unclamped scale.
function chooseLayout(landscape: number, portrait: number): ScreenLayout {
  if (landscape >= 1 || portrait >= 1) {
    return Math.floor(portrait) > Math.floor(landscape) ? PORTRAIT : LANDSCAPE;
  }
  return portrait > landscape ? PORTRAIT : LANDSCAPE;
}

/**
 * Chooses the logical screen and its integer scale (ADR-0015 decision 1). Among the screens that
 * fit at ×1 or more, the larger integer scale wins, landscape on a tie; when neither fits, the
 * screen with the larger unclamped scale wins, at ×1. Computed in device pixels.
 */
export function computeViewport(cssWidth: number, cssHeight: number, pixelRatio: number): Viewport {
  const width = cssWidth * pixelRatio;
  const height = cssHeight * pixelRatio;
  const landscape = unclampedScale(LANDSCAPE, width, height);
  const portrait = unclampedScale(PORTRAIT, width, height);
  const layout = chooseLayout(landscape, portrait);
  const scale = Math.max(1, Math.floor(layout === PORTRAIT ? portrait : landscape));
  const deviceWidth = layout.width * scale;
  const deviceHeight = layout.height * scale;
  return {
    layout,
    scale,
    deviceWidth,
    deviceHeight,
    cssWidth: deviceWidth / pixelRatio,
    cssHeight: deviceHeight / pixelRatio,
  };
}
