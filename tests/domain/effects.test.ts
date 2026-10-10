import { describe, expect, it } from 'vitest';
import { EffectTuning, Explosions, HitFlashes } from '../../src/domain/presentation/effects';
import { Palette } from '../../src/domain/presentation/palette';
import { RecordingRender } from '../support/recording-render';

describe('HitFlashes — white flash on a hit (GDD §9.4, ADR-0010)', () => {
  it('lasts about 33 ms of wall time, keyed by serial', () => {
    const flashes = new HitFlashes();
    flashes.record(7);
    expect(flashes.isFlashing(7)).toBe(true);
    expect(flashes.isFlashing(8)).toBe(false);
    flashes.advance(EffectTuning.hitFlashMs - 1);
    expect(flashes.isFlashing(7)).toBe(true);
    flashes.advance(1);
    expect(flashes.isFlashing(7)).toBe(false);
  });

  it('never ages while the frame time is 0 (frozen scenes)', () => {
    const flashes = new HitFlashes();
    flashes.record(3);
    for (let i = 0; i < 100; i += 1) flashes.advance(0);
    expect(flashes.isFlashing(3)).toBe(true);
  });
});

describe('Explosions — small bursts at destroyed enemies (GDD §9.4)', () => {
  it('lasts 300 ms of wall time, sized by tier', () => {
    const explosions = new Explosions();
    explosions.record(100, 100, 1);
    const render = new RecordingRender();
    explosions.draw(render);
    expect(render.rectsOf(Palette.explosionHot)[0]).toMatchObject({ w: 16, h: 16 });
    explosions.advance(EffectTuning.explosionMs - 1);
    expect(explosions.active).toBe(1);
    explosions.advance(1);
    expect(explosions.active).toBe(0);
  });

  it('holds at most 16 at once, recycling the oldest first', () => {
    const explosions = new Explosions();
    for (let i = 0; i < 16; i += 1) {
      explosions.record(i, 0, 0);
      explosions.advance(10);
    }
    explosions.record(99, 0, 0);
    expect(explosions.active).toBe(16);
    const render = new RecordingRender();
    explosions.draw(render);
    const centres = render.rects.map((rect) => rect.x + rect.w / 2);
    expect(centres).toContain(99);
    expect(centres).not.toContain(0); // the oldest, born first, was replaced
  });
});
