import { describe, expect, it } from 'vitest';
import type { WorldSnapshot } from '../../src/domain/game/run';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import { drawHud } from '../../src/domain/presentation/hud';
import { HUD_LAYOUT } from '../../src/domain/presentation/hud-layout';
import { Palette } from '../../src/domain/presentation/palette';
import { HUD_BAND_WIDTH } from '../../src/domain/presentation/screen';
import { RecordingRender } from '../support/recording-render';

function hudOf(values: Partial<WorldSnapshot>): RecordingRender {
  const render = new RecordingRender();
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
