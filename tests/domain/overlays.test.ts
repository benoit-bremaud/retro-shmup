import { describe, expect, it } from 'vitest';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import { drawCountIn, drawPauseIcon, drawVeil } from '../../src/domain/presentation/overlays';
import { Palette } from '../../src/domain/presentation/palette';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../src/domain/presentation/screen';
import { RecordingRender } from '../support/recording-render';

describe('overlays of the frozen scenes (meta/05-state-scenes, enemies brick additions)', () => {
  it('veils the whole play field', () => {
    const render = new RecordingRender();
    drawVeil(render);
    expect(render.rectsOf(Palette.veil)).toEqual([
      { region: 'field', x: 0, y: 0, w: FIELD_WIDTH, h: FIELD_HEIGHT, colour: Palette.veil },
    ]);
  });

  it('draws the pause icon as two bars centred on the field', () => {
    const render = new RecordingRender();
    drawPauseIcon(render);
    const bars = render.rectsOf(Palette.pauseIcon);
    expect(bars).toHaveLength(2);
    const left = Math.min(...bars.map((bar) => bar.x));
    const right = Math.max(...bars.map((bar) => bar.x + bar.w));
    expect((left + right) / 2).toBe(FIELD_WIDTH / 2);
    expect(
      bars.every((bar) => bar.region === 'field' && bar.y + bar.h / 2 === FIELD_HEIGHT / 2),
    ).toBe(true);
  });

  it.each([
    [60, '3'],
    [41, '3'],
    [40, '2'],
    [21, '2'],
    [20, '1'],
    [1, '1'],
  ])('shows the count-in digit for %i steps left: %s, centred on the field', (left, digit) => {
    const render = new RecordingRender();
    drawCountIn(render, left);
    expect(render.texts).toEqual([
      {
        region: 'field',
        x: (FIELD_WIDTH - HUD_FONT_CELL.glyphWidth) / 2,
        y: (FIELD_HEIGHT - HUD_FONT_CELL.height) / 2,
        text: digit,
        font: 'hud',
      },
    ]);
  });
});
