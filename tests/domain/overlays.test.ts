import { describe, expect, it } from 'vitest';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import {
  drawControlsScreen,
  drawCountIn,
  drawMenu,
  drawNameEntry,
  drawVeil,
} from '../../src/domain/presentation/overlays';
import { CONTROLS_COLUMNS, MENU_VALUE_MARGIN } from '../../src/domain/presentation/menu-layout';
import type { ControlsView, NameEntryView } from '../../src/domain/presentation/menu-layout';
import { Menu } from '../../src/domain/scenes/menu';
import { CountryChoice } from '../../src/domain/scenes/country-choice';
import { createIntentFrame } from '../../src/domain/ports/input-port';
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
      ['REPRENDRE', 'menu', menu.top + 11],
      ['QUITTER', 'menu', menu.top + 32 + 11],
    ]);
    const quitter = render.texts[1];
    expect(quitter?.x).toBe(Math.round((FIELD_WIDTH - (6 * 8 + 6)) / 2));
    const bars = render.rectsOf(Palette.menuHighlight);
    expect(bars).toEqual([
      {
        region: 'field',
        x: Math.round((FIELD_WIDTH - (54 + 16)) / 2),
        y: menu.top + 32,
        w: 54 + 16,
        h: 32,
        colour: Palette.menuHighlight,
      },
    ]);
  });

  it('draws a row with a value: the label on the left, the value on the right, a wide bar', () => {
    const render = new RecordingRender();
    const menu = new Menu(['autofire', 'back'] as const);
    drawMenu(render, menu, 'en', (row) => (row === 'autofire' ? 'off' : undefined));
    expect(render.texts.map((text) => [text.text, text.x])).toEqual([
      ['AUTOFIRE', MENU_VALUE_MARGIN],
      ['OFF', FIELD_WIDTH - MENU_VALUE_MARGIN - (2 * 8 + 6)],
      ['BACK', Math.round((FIELD_WIDTH - (3 * 8 + 6)) / 2)],
    ]);
    expect(render.rectsOf(Palette.menuHighlight)[0]).toMatchObject({ x: 16, w: FIELD_WIDTH - 32 });
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

describe('drawControlsScreen (GDD v0.15 §4.2)', () => {
  const view: ControlsView = {
    menu: {
      rows: ['up', 'fire', 'restoreDefaults', 'back'],
      top: 100,
      rowHeight: 24,
      highlighted: 1,
    },
    intentRows: 2,
    column: 1,
    deviceName: 'keyboard',
    cell: (row, column) =>
      [
        ['↑', 'Z'],
        ['ESPACE', 'W'],
      ][row]?.[column] ?? '',
  };

  it('draws the header, the device, each intent with its two cells, then the actions', () => {
    const render = new RecordingRender();
    drawControlsScreen(render, view, 'fr');
    expect(render.texts.map((text) => text.text)).toEqual([
      'COMMANDES',
      'CLAVIER',
      'HAUT',
      '↑',
      'Z',
      'TIR',
      'ESPACE',
      'W',
      'PAR DEFAUT',
      'RETOUR',
    ]);
    const label = render.texts.find((text) => text.text === 'TIR');
    const second = render.texts.find((text) => text.text === 'W');
    expect(label?.x).toBe(CONTROLS_COLUMNS.label);
    expect(second?.x).toBeGreaterThanOrEqual(CONTROLS_COLUMNS.slots[1]);
  });

  it('highlights the one cell of the highlighted row and column', () => {
    const render = new RecordingRender();
    drawControlsScreen(render, view, 'fr');
    expect(render.rectsOf(Palette.menuHighlight)).toEqual([
      {
        region: 'field',
        x: CONTROLS_COLUMNS.slots[1],
        y: 100 + 24,
        w: CONTROLS_COLUMNS.slotWidth,
        h: 24,
        colour: Palette.menuHighlight,
      },
    ]);
  });
});

describe('drawNameEntry (GDD v0.16 §9.1, v0.26)', () => {
  /** The country choice (GDD v0.26 §9.1), the code preselected from `country`. */
  function onCountry(country: string | undefined): CountryChoice {
    const choice = new CountryChoice();
    choice.open(0, createIntentFrame(), country);
    return choice;
  }

  function texts(entry: NameEntryView): string[] {
    const render = new RecordingRender();
    drawNameEntry(render, entry, 'fr');
    return render.texts.map((text) => text.text);
  }

  it('draws the heading, the slots and the cells in the language, OK for a known code only', () => {
    const known = texts(onCountry('FR'));
    expect(known.slice(0, 3)).toEqual(['PAYS', 'F', 'R']);
    expect(known).toEqual(expect.arrayContaining(['EFF', 'AUCUN', 'OK']));
    expect(texts(onCountry(undefined))).not.toContain('OK');
  });

  it('puts the next slot and the highlighted cell on bars', () => {
    const render = new RecordingRender();
    drawNameEntry(render, onCountry(undefined), 'en');
    const bars = render.rectsOf(Palette.menuHighlight).map((rect) => [rect.x, rect.y, rect.w]);
    expect(bars).toEqual([
      [104, 72, 16],
      [0, 105, 30], // the 32 px cell's bar keeps a 1 px gap (GDD v0.26, #115)
    ]);
  });
});
