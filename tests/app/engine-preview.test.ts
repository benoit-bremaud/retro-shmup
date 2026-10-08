import { describe, expect, it } from 'vitest';
import { EnginePreview } from '../../src/app/engine-preview';
import { STEP_SECONDS } from '../../src/app/frame-loop';
import { IdleInput } from '../../src/app/idle-input';
import { PerformanceClock } from '../../src/adapters/performance-clock';
import { createIntentFrame } from '../../src/domain/ports/input-port';
import type { RenderPort, RenderRegion } from '../../src/domain/ports/render-port';
import { Palette } from '../../src/domain/presentation/palette';
import { Starfield } from '../../src/domain/presentation/starfield';

class RecordingRender implements RenderPort {
  calls: string[] = [];
  setRegion(region: RenderRegion): void {
    this.calls.push(`region ${region}`);
  }
  clear(): void {
    this.calls.push('clear');
  }
  drawSprite(): void {
    throw new Error('not used');
  }
  drawRect(x: number, y: number, w: number, h: number, colour: string): void {
    this.calls.push(`rect ${colour} ${[x, y, w, h].join(',')}`);
  }
  drawText(): void {
    throw new Error('not used');
  }
  setCameraOffset(): void {
    /* not used */
  }
  present(): void {
    this.calls.push('present');
  }
}

class SpyStarfield extends Starfield {
  times: number[] = [];
  constructor() {
    super(() => 0.5);
  }
  override draw(_render: RenderPort, timeSeconds: number): void {
    this.times.push(timeSeconds);
  }
}

describe('EnginePreview', () => {
  it('draws the field, then the HUD bands, then presents, in that order', () => {
    const render = new RecordingRender();
    const preview = new EnginePreview(render, new SpyStarfield());
    preview.render(0);
    expect(render.calls[0]).toBe('clear');
    expect(render.calls[1]).toBe('region field');
    expect(render.calls[2]).toBe('region hud');
    expect(render.calls).toContain(`rect ${Palette.hudBand} 0,0,120,320`);
    expect(render.calls).toContain(`rect ${Palette.hudBand} 360,0,120,320`);
    expect(render.calls.at(-1)).toBe('present');
  });

  it('scrolls with simulated time and interpolates between steps', () => {
    const starfield = new SpyStarfield();
    const preview = new EnginePreview(new RecordingRender(), starfield);
    preview.step(STEP_SECONDS);
    preview.step(STEP_SECONDS);
    preview.render(0.5);
    expect(starfield.times.at(-1)).toBeCloseTo(2.5 * STEP_SECONDS, 10);
  });

  it('never changes the time scale', () => {
    expect(new EnginePreview(new RecordingRender(), new SpyStarfield()).timeScale()).toBe(1);
  });
});

describe('IdleInput', () => {
  it('leaves every frame neutral, whatever it held before', () => {
    const frame = createIntentFrame();
    frame.held = 7;
    frame.pressed = 3;
    frame.moveKind = 'target';
    frame.tapRegion = 'field';
    new IdleInput().read(frame);
    expect(frame).toMatchObject({ held: 0, pressed: 0, moveKind: 'none', tapRegion: 'none' });
  });

  it('cancels any key capture and labels keys by their code', () => {
    const input = new IdleInput();
    expect(input.captureNext()).toEqual({ kind: 'cancelled' });
    expect(input.label('KeyZ')).toBe('KeyZ');
  });
});

describe('PerformanceClock', () => {
  it('reads a monotonic clock in milliseconds', () => {
    const clock = new PerformanceClock();
    const a = clock.now();
    const b = clock.now();
    expect(b).toBeGreaterThanOrEqual(a);
  });
});
