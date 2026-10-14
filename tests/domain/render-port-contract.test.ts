import { describe, expect, it } from 'vitest';
import { RecordingRender } from '../support/recording-render';

// The test double must fail where the Canvas 2D renderer fails, or a domain test could pass on a
// string the game cannot draw (ADR-0022 decision 8).
describe('RecordingRender — the RenderPort glyph-set contract', () => {
  it('accepts the hud digits, × and the space', () => {
    const render = new RecordingRender();
    render.drawText('3 × 500  1 500', 0, 0, 'hud');
    expect(render.texts).toHaveLength(1);
  });

  it.each(['A', '-', ','])('throws on %j in the hud font', (text) => {
    expect(() => {
      new RecordingRender().drawText(text, 0, 0, 'hud');
    }).toThrow(/glyph/);
  });

  it('accepts A–Z and the space in the title font, and throws on a digit', () => {
    const render = new RecordingRender();
    render.drawText('NO BOMB', 0, 0, 'title');
    expect(() => {
      render.drawText('1', 0, 0, 'title');
    }).toThrow(/glyph/);
  });

  it('accepts A–Z, 0–9, the space and four arrows in the menu font, throws on an accent', () => {
    const render = new RecordingRender();
    render.drawText('PLEIN ECRAN', 0, 0, 'menu');
    render.drawText('NUM 0 \u2191\u2193\u2190\u2192 9', 0, 0, 'menu');
    expect(render.texts).toHaveLength(2); // and `?`, `-` below
    render.drawText('??? -', 0, 0, 'menu');
    expect(() => {
      render.drawText('!', 0, 0, 'menu');
    }).toThrow(/glyph/);
    expect(() => {
      render.drawText('É', 0, 0, 'menu');
    }).toThrow(/glyph/);
  });
});
