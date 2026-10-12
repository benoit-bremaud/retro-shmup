import type { TapRegion } from '../ports/input-port';
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
  /** Bomb icons, left to right, 8 × 8 (GDD v0.8 §9.2). */
  readonly bombs: { readonly x: number; readonly y: number; readonly spacing: number };
  /** The shield icon, while a charge is held. */
  readonly shield: { readonly x: number; readonly y: number };
  /** The 8 × 8 weapon badge at (x, y), then the five 3 × 8 power pips from `pipX` (GDD v0.8). */
  readonly weapon: {
    readonly x: number;
    readonly y: number;
    readonly pipX: number;
    readonly pipSpacing: number;
  };
}

/**
 * The HUD positions per logical screen (GDD v0.8 §9.2; meta/05-state-scenes, devices and
 * player-kit additions): one record per layout kind, so drawing reads a table and never branches
 * on the screen. Landscape: score, chain, lives and bombs down the left band, the weapon and the
 * shield in the right band, 8 px margins. Portrait: the 240 × 32 strip in two rows, 4 px margins,
 * the chain bar ending under the score's last digit.
 */
export const HUD_LAYOUTS: Readonly<Record<ScreenLayout['kind'], HudLayout>> = {
  landscape: {
    score: { x: 8, y: 8, digits: 8 },
    multiplier: { x: 8, y: 24 },
    chainBar: { x: 8, y: 38, width: 64, height: 4 },
    lives: { x: 8, y: 52, size: 8, spacing: 12 },
    bombs: { x: 8, y: 66, spacing: 12 },
    shield: { x: 368, y: 100 },
    // The right band, below the pause button and the level name's slot (y 56–76).
    weapon: { x: 368, y: 84, pipX: 380, pipSpacing: 6 },
  },
  portrait: {
    score: { x: 4, y: 4, digits: 8 },
    multiplier: { x: 4, y: 18 },
    chainBar: { x: 24, y: 21, width: 42, height: 4 },
    lives: { x: 76, y: 5, size: 8, spacing: 12 },
    bombs: { x: 76, y: 19, spacing: 12 },
    shield: { x: 172, y: 5 },
    weapon: { x: 140, y: 19, pipX: 152, pipSpacing: 6 },
  },
};

/** A rectangle in `hud` (logical-screen) pixels. */
export interface HudRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The touch pause button per logical screen (GDD v0.7 §4.2), flush with the screen's top-right
 * corner: 48 × 48 at the top of the right landscape band, 48 × 32 at the right end of the portrait
 * strip. One source for drawing and hit-testing (ADR-0018 decision 1).
 */
export const PAUSE_BUTTONS: Readonly<Record<ScreenLayout['kind'], HudRect>> = {
  landscape: { x: 432, y: 0, width: 48, height: 48 },
  portrait: { x: 192, y: 0, width: 48, height: 32 },
};

/** Whether a tap hits the pause button of `layout`; the rectangle is half-open (ADR-0018). */
export function isPauseTap(region: TapRegion, x: number, y: number, layout: ScreenLayout): boolean {
  if (region !== 'hud') return false;
  const button = PAUSE_BUTTONS[layout.kind];
  return (
    x >= button.x && x < button.x + button.width && y >= button.y && y < button.y + button.height
  );
}

/** The 1 px edge line of the portrait strip: up to the pause button's left edge. */
export const PORTRAIT_STRIP_EDGE = { y: 31, width: PAUSE_BUTTONS.portrait.x } as const;
