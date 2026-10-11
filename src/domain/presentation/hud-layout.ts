import type { ScreenLayout } from './screen';

/** Where the HUD contents sit, in `hud` (logical-screen) pixels. */
export interface HudLayout {
  /** 8 digits, zero-padded. */
  readonly score: { readonly x: number; readonly y: number; readonly digits: number };
  /** `×` then one digit. */
  readonly multiplier: { readonly x: number; readonly y: number };
  readonly chainBar: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** Reserve-life icons, left to right. */
  readonly lives: {
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly spacing: number;
  };
}

/**
 * The HUD positions per logical screen (GDD §9.2, v0.7; meta/05-state-scenes, devices brick
 * additions): one record per layout kind, so drawing reads a table and never branches on the
 * screen. Landscape: the left band, top to bottom, 8 px margins. Portrait: the 240 × 32 strip in
 * two rows, 4 px margins, the chain bar ending under the score's last digit.
 */
export const HUD_LAYOUTS: Readonly<Record<ScreenLayout['kind'], HudLayout>> = {
  landscape: {
    score: { x: 8, y: 8, digits: 8 },
    multiplier: { x: 8, y: 24 },
    chainBar: { x: 8, y: 38, width: 64, height: 4 },
    lives: { x: 8, y: 52, size: 8, spacing: 12 },
  },
  portrait: {
    score: { x: 4, y: 4, digits: 8 },
    multiplier: { x: 4, y: 18 },
    chainBar: { x: 24, y: 21, width: 42, height: 4 },
    lives: { x: 76, y: 5, size: 8, spacing: 12 },
  },
};

/** The 1 px edge line of the portrait strip: up to the pause button's left edge (C2-P). */
export const PORTRAIT_STRIP_EDGE = { y: 31, width: 192 } as const;
