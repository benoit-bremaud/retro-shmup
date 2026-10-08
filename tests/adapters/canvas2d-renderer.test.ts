import { describe, expect, it } from 'vitest';
import { Canvas2DRenderer } from '../../src/adapters/canvas2d-renderer';
import type { RenderSurface } from '../../src/adapters/canvas2d-renderer';
import { computeViewport } from '../../src/adapters/viewport';
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

  it('fails closed on sprites and text until assets are loaded', () => {
    const { renderer } = setup();
    expect(() => {
      renderer.drawSprite('ship', 0, 0);
    }).toThrow(/sprite/);
    expect(() => {
      renderer.drawText('SCORE', 0, 0, 'hud');
    }).toThrow(/font/);
  });
});
