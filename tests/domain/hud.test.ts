import { describe, expect, it } from 'vitest';
import type { WorldSnapshot } from '../../src/domain/game/run';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import { drawHud, drawHudFrame } from '../../src/domain/presentation/hud';
import { HUD_LAYOUTS } from '../../src/domain/presentation/hud-layout';
import { Palette } from '../../src/domain/presentation/palette';
import {
  HUD_BAND_WIDTH,
  HUD_STRIP_HEIGHT,
  LANDSCAPE,
  PORTRAIT,
} from '../../src/domain/presentation/screen';
import type { ScreenLayout } from '../../src/domain/presentation/screen';

const HUD_LAYOUT = HUD_LAYOUTS.landscape;
import { RecordingRender } from '../support/recording-render';

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
    lives: 3,
    score: 0,
    multiplier: 1,
    chainRatio: 0,
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

  it('keeps every element inside the left band, with 8 px margins', () => {
    const render = hudOf({ score: 99_999_999, multiplier: 8, chainRatio: 1, lives: 3 });
    const right = (x: number, w: number): number => x + w;
    for (const rect of render.rects) {
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
    expect(render.rectsOf(Palette.lifeIcon).map((icon) => icon.x)).toEqual([76, 88]);
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
      expect(rect.x + rect.w).toBeLessThanOrEqual(192 - 4);
      expect(rect.y).toBeGreaterThanOrEqual(4);
      expect(rect.y + rect.h).toBeLessThanOrEqual(HUD_STRIP_HEIGHT - 4);
    }
    for (const text of render.texts) {
      expect(text.y + HUD_FONT_CELL.height).toBeLessThanOrEqual(HUD_STRIP_HEIGHT - 4);
    }
    expect(render.rectsOf(Palette.lifeIcon)).toHaveLength(8);
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
