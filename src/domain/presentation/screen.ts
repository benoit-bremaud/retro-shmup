// Logical screen of ADR-0014: the 240 × 320 play field centred between two HUD bands. The field
// and band sizes are the inputs; the rest is derived so the geometry has a single source.
import { FIELD_HEIGHT, FIELD_WIDTH } from '../game/geometry';

export { FIELD_HEIGHT, FIELD_WIDTH };
export const HUD_BAND_WIDTH = 120;
export const FIELD_X = HUD_BAND_WIDTH;
export const SCREEN_WIDTH = FIELD_WIDTH + 2 * HUD_BAND_WIDTH;
export const SCREEN_HEIGHT = FIELD_HEIGHT;
