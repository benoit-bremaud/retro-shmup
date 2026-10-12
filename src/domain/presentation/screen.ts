// Logical screens of ADR-0014 and ADR-0015: the 240 × 320 play field with the HUD beside it
// (landscape bands) or above it (portrait strip). The field and HUD sizes are the inputs; every
// other dimension is derived from them, so the geometry has a single source.
import { FIELD_HEIGHT, FIELD_WIDTH } from '../game/geometry';

export { FIELD_HEIGHT, FIELD_WIDTH } from '../game/geometry';

/** One logical screen (ADR-0015 decision 3): its size and where the field sits in it. */
export interface ScreenLayout {
  readonly kind: 'landscape' | 'portrait';
  readonly width: number;
  readonly height: number;
  readonly fieldX: number;
  readonly fieldY: number;
}

/** Width of each landscape HUD band, left and right of the field (GDD §3.1). */
export const HUD_BAND_WIDTH = 120;
/** Height of the portrait HUD strip above the field (GDD §3.1, v0.7 §9.2). */
export const HUD_STRIP_HEIGHT = 32;

/** 480 × 320: the field between the two HUD bands. */
export const LANDSCAPE: ScreenLayout = {
  kind: 'landscape',
  width: FIELD_WIDTH + 2 * HUD_BAND_WIDTH,
  height: FIELD_HEIGHT,
  fieldX: HUD_BAND_WIDTH,
  fieldY: 0,
};

/** 240 × 352: the HUD strip above the field. */
export const PORTRAIT: ScreenLayout = {
  kind: 'portrait',
  width: FIELD_WIDTH,
  height: HUD_STRIP_HEIGHT + FIELD_HEIGHT,
  fieldX: 0,
  fieldY: HUD_STRIP_HEIGHT,
};
