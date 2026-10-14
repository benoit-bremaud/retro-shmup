import { describe, expect, it } from 'vitest';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import { drawCountIn, drawMenu, drawVeil } from '../../src/domain/presentation/overlays';
import { MENU_ROW_HEIGHT } from '../../src/domain/presentation/menu-layout';
import { Menu } from '../../src/domain/scenes/menu';
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

  it('draws a menu: each row centred in the menu font, the highlighted one on a bar', () => {
    const render = new RecordingRender();
    const menu = new Menu(['resume', 'quit'] as const);
    menu.highlighted = 1;
    drawMenu(render, menu, 'fr');
    expect(render.texts.map((text) => [text.text, text.font, text.y])).toEqual([
      ['REPRENDRE', 'menu', menu.top + 3],
      ['QUITTER', 'menu', menu.top + MENU_ROW_HEIGHT + 3],
    ]);
    const quitter = render.texts[1];
    expect(quitter?.x).toBe(Math.round((FIELD_WIDTH - (6 * 8 + 6)) / 2));
    const bars = render.rectsOf(Palette.menuHighlight);
    expect(bars).toEqual([
      {
        region: 'field',
        x: Math.round((FIELD_WIDTH - (54 + 16)) / 2),
        y: menu.top + MENU_ROW_HEIGHT,
        w: 54 + 16,
        h: MENU_ROW_HEIGHT,
        colour: Palette.menuHighlight,
      },
    ]);
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
