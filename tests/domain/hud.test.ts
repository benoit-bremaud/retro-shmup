import { describe, expect, it } from 'vitest';
import type { WorldSnapshot } from '../../src/domain/game/run';
import { WeaponKind } from '../../src/domain/game/weapon';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import { drawHud, drawHudFrame, drawPauseButton } from '../../src/domain/presentation/hud';
import {
  HUD_LAYOUTS,
  isPauseTap,
  PAUSE_BUTTONS,
  PORTRAIT_STRIP_EDGE,
} from '../../src/domain/presentation/hud-layout';
import { Palette } from '../../src/domain/presentation/palette';
import {
  HUD_BAND_WIDTH,
  HUD_STRIP_HEIGHT,
  LANDSCAPE,
  PORTRAIT,
} from '../../src/domain/presentation/screen';
import type { ScreenLayout } from '../../src/domain/presentation/screen';

import { RecordingRender } from '../support/recording-render';
import type { RecordedRect } from '../support/recording-render';
import { IDLE_BOSS } from '../support/boss-snapshot';

const HUD_LAYOUT = HUD_LAYOUTS.landscape;

/** The left edge of each 8 × 8 icon drawn in `colour`: its widest rectangle spans the icon. */
function iconLefts(render: RecordingRender, colour: string): number[] {
  return render
    .rectsOf(colour)
    .filter((rect) => rect.w === 8)
    .map((rect) => rect.x);
}

function hudOf(values: Partial<WorldSnapshot>, screen: ScreenLayout = LANDSCAPE): RecordingRender {
  const render = new RecordingRender();
  render.screen = screen;
  const empty = {
    count: 0,
    at: (): never => {
      throw new RangeError('empty');
    },
  };
  drawHud(render, {
    player: {
      position: { x: 0, y: 0 },
      previousPosition: { x: 0, y: 0 },
      state: 'VULNERABLE',
      protectionSteps: 0,
    },
    playerBullets: empty,
    enemyBullets: empty,
    enemies: empty,
    pickups: empty,
    boss: IDLE_BOSS,
    weaponKind: WeaponKind.Spread,
    power: 1,
    bombs: 0,
    shield: false,
    lives: 3,
    score: 0,
    multiplier: 1,
    chainRatio: 0,
    playerShots: 0,
    enemyShots: 0,
    ...values,
  });
  return render;
}

describe('drawHud — left band (GDD §9.2, meta/05-state-scenes)', () => {
  it('draws the score as 8 digits, zero-padded, one cell each', () => {
    const render = hudOf({ score: 1250 });
    const score = render.texts
      .filter((text) => text.y === HUD_LAYOUT.score.y)
      .sort((a, b) => a.x - b.x);
    expect(score.map((text) => text.text).join('')).toBe('00001250');
    expect(score.map((text) => text.x)).toEqual(
      Array.from({ length: 8 }, (_, cell) => HUD_LAYOUT.score.x + cell * HUD_FONT_CELL.width),
    );
  });

  it('caps the score display at 99999999', () => {
    const render = hudOf({ score: 123_456_789 });
    const score = render.texts
      .filter((text) => text.y === HUD_LAYOUT.score.y)
      .sort((a, b) => a.x - b.x);
    expect(score.map((text) => text.text).join('')).toBe('99999999');
  });

  it('draws the multiplier as × then its digit', () => {
    const render = hudOf({ multiplier: 4 });
    const row = render.texts
      .filter((text) => text.y === HUD_LAYOUT.multiplier.y)
      .sort((a, b) => a.x - b.x);
    expect(row.map((text) => text.text).join('')).toBe('×4');
  });

  it.each([
    [1, 64],
    [0.5, 32],
    [0, 0],
  ])('fills the chain bar to the chain ratio %f (%i px)', (ratio, width) => {
    const render = hudOf({ chainRatio: ratio });
    expect(render.rectsOf(Palette.chainTrack)[0]?.w).toBe(HUD_LAYOUT.chainBar.width);
    expect(render.rectsOf(Palette.chainBar).reduce((sum, rect) => sum + rect.w, 0)).toBe(width);
  });

  it('keeps every left-band element inside the left band, with 8 px margins', () => {
    const render = hudOf({ score: 99_999_999, multiplier: 8, chainRatio: 1, lives: 3 });
    const right = (x: number, w: number): number => x + w;
    for (const rect of render.rects.filter((r) => r.x < HUD_BAND_WIDTH)) {
      expect(rect.x).toBeGreaterThanOrEqual(8);
      expect(right(rect.x, rect.w)).toBeLessThanOrEqual(HUD_BAND_WIDTH - 8);
    }
    for (const text of render.texts) {
      expect(text.region).toBe('hud');
      expect(right(text.x, HUD_FONT_CELL.glyphWidth)).toBeLessThanOrEqual(HUD_BAND_WIDTH - 8);
    }
  });
});

describe('drawHud — portrait strip (GDD v0.7 §9.2, meta/05-state-scenes devices brick)', () => {
  it('puts the score, multiplier, chain bar and lives at the strip positions', () => {
    const render = hudOf({ score: 1250, multiplier: 3, chainRatio: 1, lives: 3 }, PORTRAIT);
    const portrait = HUD_LAYOUTS.portrait;
    const score = render.texts.filter((text) => text.y === portrait.score.y);
    expect(Math.min(...score.map((text) => text.x))).toBe(4);
    expect(render.texts.find((text) => text.y === portrait.multiplier.y)?.x).toBe(4);
    expect(render.rectsOf(Palette.chainTrack)[0]).toMatchObject({ x: 24, y: 21, w: 42, h: 4 });
    expect(iconLefts(render, Palette.lifeIcon)).toEqual([76, 88]);
  });

  it("ends the chain bar under the score's last digit", () => {
    const portrait = HUD_LAYOUTS.portrait;
    const scoreEnd =
      portrait.score.x +
      (portrait.score.digits - 1) * HUD_FONT_CELL.width +
      HUD_FONT_CELL.glyphWidth;
    expect(portrait.chainBar.x + portrait.chainBar.width).toBe(scoreEnd);
  });

  it('keeps everything inside the strip with 4 px margins, left of the pause button, 8 lives included', () => {
    const render = hudOf({ score: 99_999_999, multiplier: 8, chainRatio: 1, lives: 9 }, PORTRAIT);
    for (const rect of render.rects) {
      expect(rect.x).toBeGreaterThanOrEqual(4);
      expect(rect.x + rect.w).toBeLessThanOrEqual(PORTRAIT_STRIP_EDGE.width - 4);
      expect(rect.y).toBeGreaterThanOrEqual(4);
      expect(rect.y + rect.h).toBeLessThanOrEqual(HUD_STRIP_HEIGHT - 4);
    }
    for (const text of render.texts) {
      expect(text.y + HUD_FONT_CELL.height).toBeLessThanOrEqual(HUD_STRIP_HEIGHT - 4);
    }
    expect(iconLefts(render, Palette.lifeIcon)).toHaveLength(8);
  });
});

describe('drawHudFrame — the HUD background of each screen', () => {
  it('draws the two landscape bands with their edge lines', () => {
    const render = new RecordingRender();
    drawHudFrame(render);
    expect(render.rectsOf(Palette.hudBand).map((band) => [band.x, band.w, band.h])).toEqual([
      [0, HUD_BAND_WIDTH, 320],
      [360, HUD_BAND_WIDTH, 320],
    ]);
    expect(render.rectsOf(Palette.hudEdge).map((edge) => edge.x)).toEqual([119, 360]);
  });

  it('draws the portrait strip with its bottom edge line, up to the pause button', () => {
    const render = new RecordingRender();
    render.screen = PORTRAIT;
    drawHudFrame(render);
    expect(render.rectsOf(Palette.hudBand)).toEqual([
      { region: 'hud', x: 0, y: 0, w: 240, h: HUD_STRIP_HEIGHT, colour: Palette.hudBand },
    ]);
    expect(render.rectsOf(Palette.hudEdge)).toEqual([
      { region: 'hud', x: 0, y: 31, w: 192, h: 1, colour: Palette.hudEdge },
    ]);
  });
});

describe('Pause button — the touch pause button (GDD v0.7 §4.2, ADR-0018 decision 1)', () => {
  it('sits flush with the top-right corner of each screen', () => {
    expect(PAUSE_BUTTONS.landscape).toEqual({ x: 432, y: 0, width: 48, height: 48 });
    expect(PAUSE_BUTTONS.portrait).toEqual({ x: 192, y: 0, width: 48, height: 32 });
    expect(PAUSE_BUTTONS.landscape.x + PAUSE_BUTTONS.landscape.width).toBe(LANDSCAPE.width);
    expect(PAUSE_BUTTONS.portrait.x + PAUSE_BUTTONS.portrait.width).toBe(PORTRAIT.width);
  });

  it.each([
    ['landscape', LANDSCAPE, [450, 16, 458, 16]],
    ['portrait', PORTRAIT, [210, 8, 218, 8]],
  ] as const)(
    'draws two 4 × 16 bars centred in the %s button',
    (_label, screen, [lx, ly, rx, ry]) => {
      const render = new RecordingRender();
      render.screen = screen;
      drawPauseButton(render);
      expect(render.rectsOf(Palette.pauseButton)).toEqual([
        { region: 'hud', x: lx, y: ly, w: 4, h: 16, colour: Palette.pauseButton },
        { region: 'hud', x: rx, y: ry, w: 4, h: 16, colour: Palette.pauseButton },
      ]);
    },
  );

  it.each([
    ['its top-left pixel', 'hud', 192, 0, true],
    ['its bottom-right pixel', 'hud', 239, 31, true],
    ['the pixel left of it (half-open)', 'hud', 191, 0, false],
    ['the pixel below it (half-open)', 'hud', 192, 32, false],
    ['a field tap at the same coordinates', 'field', 200, 10, false],
    ['no tap', 'none', 200, 10, false],
  ] as const)('hit-tests %s on the portrait screen', (_label, region, x, y, hit) => {
    expect(isPauseTap(region, x, y, PORTRAIT)).toBe(hit);
  });

  it('hit-tests the landscape button, not the portrait one', () => {
    expect(isPauseTap('hud', 432, 47, LANDSCAPE)).toBe(true);
    expect(isPauseTap('hud', 200, 10, LANDSCAPE)).toBe(false);
  });

  it('ends the portrait edge line at the button', () => {
    expect(PORTRAIT_STRIP_EDGE.width).toBe(PAUSE_BUTTONS.portrait.x);
  });
});

describe('drawHud — weapon badge and power pips (GDD v0.8 §9.2)', () => {
  const badgeOf = (render: RecordingRender, colour: string): RecordedRect[] =>
    render.rectsOf(colour);

  it('draws the Spread badge as three dots and the Laser badge as one bar', () => {
    const spread = hudOf({ weaponKind: WeaponKind.Spread });
    expect(badgeOf(spread, Palette.spreadBadge).map((r) => [r.x, r.y, r.w, r.h])).toEqual([
      [368, 87, 2, 2],
      [371, 87, 2, 2],
      [374, 87, 2, 2],
    ]);
    const laser = hudOf({ weaponKind: WeaponKind.Laser });
    expect(badgeOf(laser, Palette.laserBadge).map((r) => [r.x, r.y, r.w, r.h])).toEqual([
      [371, 84, 2, 8],
    ]);
    expect(laser.drew(Palette.spreadBadge)).toBe(false);
  });

  it('fills the pips up to the power level and outlines the rest, every 6 px', () => {
    const render = hudOf({ power: 3 });
    expect(render.rectsOf(Palette.pipOn).map((r) => [r.x, r.y, r.w, r.h])).toEqual([
      [380, 84, 3, 8],
      [386, 84, 3, 8],
      [392, 84, 3, 8],
    ]);
    const hollowLefts = render.rectsOf(Palette.pipOff).filter((r) => r.h === 8);
    expect(hollowLefts.map((r) => r.x)).toEqual([398, 400, 404, 406]);
  });

  it('keeps the right-band items inside the band, below the pause button', () => {
    const render = hudOf({ power: 5, weaponKind: WeaponKind.Laser });
    const right = render.rects.filter((r) => r.x >= LANDSCAPE.fieldX + 240);
    expect(right.length).toBeGreaterThan(0);
    for (const rect of right) {
      expect(rect.x).toBeGreaterThanOrEqual(368);
      expect(rect.x + rect.w).toBeLessThanOrEqual(480 - 8);
      expect(rect.y).toBeGreaterThanOrEqual(PAUSE_BUTTONS.landscape.height);
    }
  });

  it('puts the badge and pips on the second portrait row, ending at x 179', () => {
    const render = hudOf({ power: 5 }, PORTRAIT);
    expect(render.rectsOf(Palette.spreadBadge)[0]).toMatchObject({ x: 140, y: 22 });
    const pips = render.rectsOf(Palette.pipOn);
    expect(pips.map((r) => r.x)).toEqual([152, 158, 164, 170, 176]);
    expect(Math.max(...pips.map((r) => r.x + r.w))).toBe(179);
    expect(pips.every((r) => r.y === 19)).toBe(true);
  });
});

describe('drawHud — bombs and shield (GDD v0.8 §9.2)', () => {
  it('draws one plus per bomb and the shield square while a charge is held', () => {
    const render = hudOf({ bombs: 5, shield: true });
    expect(iconLefts(render, Palette.bombIcon)).toEqual([8, 20, 32, 44, 56]);
    expect(render.rectsOf(Palette.bombIcon).every((r) => r.y >= 66 && r.y + r.h <= 74)).toBe(true);
    expect(render.rectsOf(Palette.shieldIcon)[0]).toMatchObject({ x: 368, y: 100, w: 8 });
    expect(hudOf({ shield: false }).drew(Palette.shieldIcon)).toBe(false);
  });

  it('keeps 5 bombs and the shield inside the portrait strip, left of the pause button', () => {
    const render = hudOf({ bombs: 5, shield: true, lives: 9, power: 5 }, PORTRAIT);
    expect(iconLefts(render, Palette.bombIcon)).toEqual([76, 88, 100, 112, 124]);
    for (const rect of render.rects.filter((r) => r.region === 'hud' && r.y < 32)) {
      if (rect.colour === Palette.hudBand || rect.colour === Palette.hudEdge) continue;
      expect(rect.x + rect.w).toBeLessThanOrEqual(PORTRAIT_STRIP_EDGE.width - 4);
      expect(rect.y + rect.h).toBeLessThanOrEqual(HUD_STRIP_HEIGHT - 4);
    }
    expect(render.rectsOf(Palette.shieldIcon)[0]).toMatchObject({ x: 172, y: 5 });
  });
});
