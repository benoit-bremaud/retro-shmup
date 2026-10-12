import { describe, expect, it } from 'vitest';
import type { TallyView } from '../../src/domain/game/level-tally';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import { Palette } from '../../src/domain/presentation/palette';
import {
  drawResults,
  formatTallyValues,
  groupThousands,
  RESULTS_LINES,
} from '../../src/domain/presentation/results';
import { FIELD_WIDTH } from '../../src/domain/presentation/screen';
import { RecordingRender } from '../support/recording-render';

function tally(
  formationsCleared: number,
  bombUsed: boolean,
  lifeLost: boolean,
  bombsLeft: number,
): TallyView {
  const total =
    formationsCleared * 500 + (bombUsed ? 0 : 5000) + (lifeLost ? 0 : 10000) + bombsLeft * 1000;
  return { formationsCleared, bombUsed, lifeLost, bombsLeft, total: () => total };
}

describe('groupThousands — values grouped with a space (GDD v0.10 §8)', () => {
  it.each([
    [0, '0'],
    [500, '500'],
    [1500, '1 500'],
    [10000, '10 000'],
    [100000, '100 000'],
    [1234567, '1 234 567'],
  ])('writes %d as %j', (value, text) => {
    expect(groupThousands(value)).toBe(text);
  });
});

describe('formatTallyValues — the five values, formatted once', () => {
  it('writes the count and the product, each bonus kept or 0, and the total', () => {
    expect(formatTallyValues(tally(3, false, false, 2))).toEqual([
      '3 × 500  1 500',
      '5 000',
      '10 000',
      '2 × 1 000  2 000',
      '18 500',
    ]);
  });

  it('shows a missed bonus as 0, never hidden', () => {
    expect(formatTallyValues(tally(0, true, true, 0))).toEqual([
      '0 × 500  0',
      '0',
      '0',
      '0 × 1 000  0',
      '0',
    ]);
  });
});

describe('drawResults — the Results screen (GDD v0.10 §8, ADR-0022 decision 9)', () => {
  const VALUES = formatTallyValues(tally(3, false, true, 2));

  function draw(language: 'en' | 'fr', steps: number): RecordingRender {
    const render = new RecordingRender();
    drawResults(render, VALUES, steps, language);
    return render;
  }

  it('veils the field and draws the LEVEL CLEAR header centred in the title font', () => {
    const render = draw('en', 0);
    expect(render.drew(Palette.veil)).toBe(true);
    const header = render.texts[0];
    expect(header).toMatchObject({ region: 'field', text: 'LEVEL CLEAR', font: 'title' });
    expect(header?.x).toBe(34);
  });

  it('shows the first line at once and one more every 30 steps, up to five', () => {
    const shown = (steps: number): number =>
      draw('en', steps).texts.filter((text) => text.font === 'hud').length;
    expect([0, 29, 30, 59, 60, 90, 120, 479].map(shown)).toEqual([1, 1, 2, 2, 3, 4, 5, 5]);
    expect(RESULTS_LINES).toBe(5);
  });

  it('draws each label at the left margin and its value right-aligned on the row below', () => {
    const render = draw('en', 120);
    const labels = render.texts.filter((text) => text.font === 'title').slice(1);
    const values = render.texts.filter((text) => text.font === 'hud');
    expect(labels.map((text) => text.text)).toEqual([
      'FORMATIONS',
      'NO BOMB',
      'NO MISS',
      'BOMBS',
      'TOTAL',
    ]);
    expect(values.map((text) => text.text)).toEqual([
      '3 × 500  1 500',
      '5 000',
      '0',
      '2 × 1 000  2 000',
      '8 500',
    ]);
    for (let i = 0; i < values.length; i += 1) {
      const label = labels[i];
      const value = values[i];
      if (label === undefined || value === undefined) throw new Error('missing line');
      expect(label.x).toBe(8);
      expect(value.y).toBeGreaterThan(label.y);
      const right =
        value.x + (value.text.length - 1) * HUD_FONT_CELL.width + HUD_FONT_CELL.glyphWidth;
      expect(right).toBe(FIELD_WIDTH - 8);
    }
    // Every row fits the 320 px field.
    expect(Math.max(...values.map((value) => value.y + HUD_FONT_CELL.height))).toBeLessThanOrEqual(
      320,
    );
  });

  it('draws the French labels and header from the catalogue', () => {
    const render = draw('fr', 120);
    expect(render.texts.filter((text) => text.font === 'title').map((text) => text.text)).toEqual([
      'FIN DU NIVEAU',
      'FORMATIONS',
      'SANS BOMBE',
      'SANS PERTE',
      'BOMBES',
      'TOTAL',
    ]);
  });
});
