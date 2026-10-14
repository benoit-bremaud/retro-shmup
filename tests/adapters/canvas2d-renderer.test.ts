import { describe, expect, it } from 'vitest';
import { Canvas2DRenderer } from '../../src/adapters/canvas2d-renderer';
import type { RenderSurface } from '../../src/adapters/canvas2d-renderer';
import { computeViewport } from '../../src/adapters/viewport';
import { HUD_FONT_CELL } from '../../src/domain/ports/render-port';
import { Palette } from '../../src/domain/presentation/palette';

class RecordingSurface implements RenderSurface {
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  imageSmoothingEnabled = true;
  calls: string[] = [];
  fillRect(x: number, y: number, w: number, h: number): void {
    const style = typeof this.fillStyle === 'string' ? this.fillStyle : 'non-colour';
    this.calls.push(`fillRect ${style} ${[x, y, w, h].join(',')}`);
  }
  save(): void {
    this.calls.push('save');
  }
  restore(): void {
    this.calls.push('restore');
  }
  beginPath(): void {
    this.calls.push('beginPath');
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.calls.push(`rect ${[x, y, w, h].join(',')}`);
  }
  clip(): void {
    this.calls.push('clip');
  }
  drawImage(_image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void {
    this.calls.push(
      `drawImage smoothing=${String(this.imageSmoothingEnabled)} ${[dx, dy, dw, dh].join(',')}`,
    );
  }
}

const image = {} as CanvasImageSource;

function setup(): {
  renderer: Canvas2DRenderer;
  offscreen: RecordingSurface;
  visible: RecordingSurface;
} {
  const offscreen = new RecordingSurface();
  const visible = new RecordingSurface();
  const renderer = new Canvas2DRenderer(offscreen, image, visible);
  renderer.resize(computeViewport(1920, 1080, 1));
  return { renderer, offscreen, visible };
}

describe('Canvas2DRenderer (ADR-0001, ADR-0010, ADR-0014)', () => {
  it('clears the whole 480 × 320 logical screen with the background token', () => {
    const { renderer, offscreen } = setup();
    renderer.clear();
    expect(offscreen.calls).toContain(`fillRect ${Palette.background} 0,0,480,320`);
  });

  it('offsets field drawing by the field origin and clips it to 240 × 320', () => {
    const { renderer, offscreen } = setup();
    renderer.setRegion('field');
    renderer.drawRect(10, 20, 2, 2, Palette.starNear);
    expect(offscreen.calls).toEqual([
      'save',
      'beginPath',
      'rect 120,0,240,320',
      'clip',
      `fillRect ${Palette.starNear} 130,20,2,2`,
    ]);
  });

  it('draws the HUD in logical-screen coordinates, without clipping', () => {
    const { renderer, offscreen } = setup();
    renderer.setRegion('field');
    renderer.setRegion('hud');
    renderer.drawRect(5, 6, 1, 1, Palette.hudEdge);
    expect(offscreen.calls.slice(-2)).toEqual(['restore', `fillRect ${Palette.hudEdge} 5,6,1,1`]);
  });

  it('rounds positions to whole logical pixels (pixel-perfect)', () => {
    const { renderer, offscreen } = setup();
    renderer.setRegion('hud');
    renderer.drawRect(10.4, 20.6, 1, 1, Palette.starFar);
    expect(offscreen.calls.at(-1)).toBe(`fillRect ${Palette.starFar} 10,21,1,1`);
  });

  it('applies the camera offset (screen shake) to the field only', () => {
    const { renderer, offscreen } = setup();
    renderer.setCameraOffset(3, -2);
    renderer.setRegion('field');
    renderer.drawRect(0, 10, 1, 1, Palette.starMid);
    renderer.setRegion('hud');
    renderer.drawRect(0, 10, 1, 1, Palette.starMid);
    expect(offscreen.calls).toContain(`fillRect ${Palette.starMid} 123,8,1,1`);
    expect(offscreen.calls.at(-1)).toBe(`fillRect ${Palette.starMid} 0,10,1,1`);
  });

  it('leaves the field clip before clearing, so the clear covers the whole screen', () => {
    const { renderer, offscreen } = setup();
    renderer.setRegion('field');
    renderer.clear();
    const restore = offscreen.calls.lastIndexOf('restore');
    const clear = offscreen.calls.indexOf(`fillRect ${Palette.background} 0,0,480,320`);
    expect(restore).toBeGreaterThan(-1);
    expect(restore).toBeLessThan(clear);
  });

  it('presents the logical screen scaled by the integer factor, smoothing off', () => {
    const { renderer, visible } = setup();
    renderer.present();
    expect(visible.calls).toEqual(['drawImage smoothing=false 0,0,1440,960']);
  });

  it('leaves the field clip before presenting', () => {
    const { renderer, offscreen } = setup();
    renderer.setRegion('field');
    renderer.present();
    expect(offscreen.calls.at(-1)).toBe('restore');
  });

  it('fails closed on sprites until the sprite sheet is loaded', () => {
    const { renderer } = setup();
    expect(() => {
      renderer.drawSprite('ship', 0, 0);
    }).toThrow(/sprite/);
  });
});

/** The 2 × 2 blocks drawn for a text, as "x,y" pairs in logical-screen pixels. */
function textBlocks(surface: RecordingSurface): string[] {
  const prefix = `fillRect ${Palette.hudText} `;
  return surface.calls
    .filter((call) => call.startsWith(prefix))
    .map((call) => call.slice(prefix.length).split(',').slice(0, 2).join(','));
}

describe('Canvas2DRenderer — hud font (RenderPort contract, HUD_FONT_CELL)', () => {
  it('draws a digit as 2 × 2 blocks of its 3 × 5 glyph, from the top-left of its cell', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText('1', 10, 20, 'hud');
    // Glyph "1": 010 / 110 / 010 / 010 / 111.
    expect(textBlocks(offscreen)).toEqual([
      '12,20',
      '10,22',
      '12,22',
      '12,24',
      '12,26',
      '10,28',
      '12,28',
      '14,28',
    ]);
    expect(
      offscreen.calls.every((call) => !call.includes(Palette.hudText) || call.endsWith(',2,2')),
    ).toBe(true);
  });

  it('advances one cell per character', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText('11', 0, 0, 'hud');
    expect(textBlocks(offscreen)).toContain(`${String(2 + HUD_FONT_CELL.width)},0`);
  });

  it('offsets field text by the field origin and the camera offset', () => {
    const { renderer, offscreen } = setup();
    renderer.setCameraOffset(1, 2);
    renderer.setRegion('field');
    renderer.drawText('1', 0, 0, 'hud');
    expect(textBlocks(offscreen)[0]).toBe('123,2');
  });

  it('draws the multiplication sign U+00D7', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText('×', 0, 0, 'hud');
    expect(textBlocks(offscreen)).toEqual(['0,2', '4,2', '2,4', '0,6', '4,6']);
  });

  it('draws the space as an empty cell that still advances (ADR-0022 decision 8)', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText(' ', 0, 0, 'hud');
    expect(textBlocks(offscreen)).toEqual([]);
    renderer.drawText('1 1', 0, 0, 'hud');
    expect(textBlocks(offscreen)).toContain(`${String(2 + 2 * HUD_FONT_CELL.width)},0`);
  });

  it.each(['A', '-', 'x', '\t'])('throws on %j, outside the glyph set (fail closed)', (text) => {
    const { renderer } = setup();
    expect(() => {
      renderer.drawText(text, 0, 0, 'hud');
    }).toThrow(/glyph/);
  });

  it('draws the title font at 4×, one 16 px cell per letter, in the title colour', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText('LI', 0, 0, 'title');
    const blocks = offscreen.calls.filter((call) =>
      call.startsWith(`fillRect ${Palette.titleText} `),
    );
    // "L": 5 rows of the left column plus the 2 other bottom pixels; "I": 3 + 3 + 3.
    expect(blocks).toHaveLength(7 + 9);
    expect(blocks[0]).toBe(`fillRect ${Palette.titleText} 0,0,4,4`);
    expect(blocks).toContain(`fillRect ${Palette.titleText} 16,0,4,4`);
  });

  it.each(['a', '1', '×'])('throws on %j in the title font (fail closed)', (text) => {
    const { renderer } = setup();
    expect(() => {
      renderer.drawText(text, 0, 0, 'title');
    }).toThrow(/glyph/);
  });

  it('draws the menu font: the title letters at 2×, one 8 px cell each, in the title colour', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText('LI', 0, 0, 'menu');
    const blocks = offscreen.calls.filter((call) =>
      call.startsWith(`fillRect ${Palette.titleText} `),
    );
    expect(blocks).toHaveLength(7 + 9);
    expect(blocks[0]).toBe(`fillRect ${Palette.titleText} 0,0,2,2`);
    expect(blocks).toContain(`fillRect ${Palette.titleText} 8,0,2,2`);
  });

  it('draws digits and the four arrows in the menu font', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText('1\u2191\u2193\u2190\u2192', 0, 0, 'menu');
    const blocks = offscreen.calls.filter((call) =>
      call.startsWith(`fillRect ${Palette.titleText} `),
    );
    expect(blocks.length).toBeGreaterThan(5 * 4);
  });

  it('draws ? and - in the menu font', () => {
    const { renderer, offscreen } = setup();
    renderer.drawText('?-', 0, 0, 'menu');
    const blocks = offscreen.calls.filter((call) =>
      call.startsWith(`fillRect ${Palette.titleText} `),
    );
    expect(blocks).toHaveLength(6 + 3); // `?`: 3 + 1 + 1 + 1 pixels; `-`: 3
  });

  it.each(['!', 'É'])('throws on %j in the menu font (fail closed)', (text) => {
    const { renderer } = setup();
    expect(() => {
      renderer.drawText(text, 0, 0, 'menu');
    }).toThrow(/glyph/);
  });
});

describe('Canvas2DRenderer — portrait screen (ADR-0015 decisions 1–3, ADR-0018 decision 6)', () => {
  function portrait(): { renderer: Canvas2DRenderer; offscreen: RecordingSurface } {
    const offscreen = new RecordingSurface();
    const renderer = new Canvas2DRenderer(offscreen, image, new RecordingSurface());
    renderer.resize(computeViewport(390, 844, 3));
    return { renderer, offscreen };
  }

  it('reports the screen chosen by the viewport', () => {
    expect(portrait().renderer.layout().kind).toBe('portrait');
    expect(setup().renderer.layout().kind).toBe('landscape');
  });

  it('clips the field at (0, 32) under the HUD strip and offsets field draws there', () => {
    const { renderer, offscreen } = portrait();
    renderer.setRegion('field');
    renderer.drawRect(10, 20, 2, 2, Palette.starNear);
    expect(offscreen.calls).toEqual([
      'save',
      'beginPath',
      'rect 0,32,240,320',
      'clip',
      `fillRect ${Palette.starNear} 10,52,2,2`,
    ]);
  });

  it('clears the whole 240 × 352 portrait screen', () => {
    const { renderer, offscreen } = portrait();
    renderer.clear();
    expect(offscreen.calls).toContain(`fillRect ${Palette.background} 0,0,240,352`);
  });

  it('resets its region and camera on resize without restore(), since the canvas reset them', () => {
    const { renderer, offscreen } = setup();
    renderer.setCameraOffset(3, 3);
    renderer.setRegion('field');
    offscreen.calls.length = 0;
    renderer.resize(computeViewport(390, 844, 3));
    expect(offscreen.calls).toEqual([]);
    renderer.setRegion('field');
    renderer.drawRect(0, 0, 1, 1, Palette.starFar);
    expect(offscreen.calls.at(-1)).toBe(`fillRect ${Palette.starFar} 0,32,1,1`);
  });
});
