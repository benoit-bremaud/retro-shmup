import { describe, expect, it } from 'vitest';
import { EnginePreview } from '../../src/app/engine-preview';
import { STEP_SECONDS } from '../../src/app/frame-loop';
import type { RenderPort, RenderRegion } from '../../src/domain/ports/render-port';
import { Palette } from '../../src/domain/presentation/palette';
import { STARFIELD_LAYERS, Starfield } from '../../src/domain/presentation/starfield';

/** Port double: records what is drawn, in order. The starfield itself is the real domain object. */
class RecordingRender implements RenderPort {
  calls: string[] = [];
  starYs: number[] = [];
  private region: RenderRegion = 'hud';
  setRegion(region: RenderRegion): void {
    this.region = region;
    this.calls.push(`region ${region}`);
  }
  clear(): void {
    this.calls.push('clear');
  }
  drawSprite(): void {
    throw new Error('not used');
  }
  drawRect(x: number, y: number, w: number, h: number, colour: string): void {
    const isStar = this.region === 'field';
    if (isStar) this.starYs.push(y);
    this.calls.push(isStar ? 'star' : `rect ${colour} ${[x, y, w, h].join(',')}`);
  }
  drawText(): void {
    throw new Error('not used');
  }
  setCameraOffset(): void {
    // Not used by the preview.
  }
  present(): void {
    this.calls.push('present');
  }
}

/** Every star starts at the middle of the field, so its drawn y reveals the scroll time. */
function middleStarfield(): Starfield {
  return new Starfield(() => 0.5);
}

describe('EnginePreview', () => {
  it('clears, draws every star inside the field region, then the HUD bands, then presents', () => {
    const render = new RecordingRender();
    new EnginePreview(render, middleStarfield()).render(0);
    const { calls } = render;
    const firstStar = calls.indexOf('star');
    const lastStar = calls.lastIndexOf('star');
    expect(calls[0]).toBe('clear');
    expect(calls.indexOf('region field')).toBeLessThan(firstStar);
    expect(lastStar).toBeLessThan(calls.indexOf('region hud'));
    expect(calls.filter((call) => call === 'star')).toHaveLength(
      STARFIELD_LAYERS.reduce((sum, layer) => sum + layer.count, 0),
    );
    expect(calls).toContain(`rect ${Palette.hudBand} 0,0,120,320`);
    expect(calls).toContain(`rect ${Palette.hudBand} 360,0,120,320`);
    expect(calls.at(-1)).toBe('present');
  });

  it('scrolls with simulated time and interpolates between steps', () => {
    const render = new RecordingRender();
    const preview = new EnginePreview(render, middleStarfield());
    preview.step(STEP_SECONDS);
    preview.step(STEP_SECONDS);
    preview.render(0.5);
    const slowest = STARFIELD_LAYERS[0];
    if (slowest === undefined) throw new Error('no layer');
    expect(render.starYs[0]).toBeCloseTo(160 + slowest.speed * 2.5 * STEP_SECONDS, 4);
  });

  it('never changes the time scale', () => {
    expect(new EnginePreview(new RecordingRender(), middleStarfield()).timeScale()).toBe(1);
  });
});
