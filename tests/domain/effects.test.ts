import { describe, expect, it } from 'vitest';
import {
  ChainLabel,
  EffectTuning,
  ExplosionTier,
  Explosions,
  GrazeSparks,
  HitFlashes,
} from '../../src/domain/presentation/effects';
import { Palette } from '../../src/domain/presentation/palette';
import { RecordingRender } from '../support/recording-render';
import type { RecordedRect } from '../support/recording-render';

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

describe('Explosions — animated bursts, style A without white (GDD v0.10 §9.4, F-2c)', () => {
  const fragmentsOf = (render: RecordingRender): number =>
    render.rects.filter((rect) => rect.w <= 2 && rect.h <= 2).length;

  it('lasts 300 ms of wall time', () => {
    const explosions = new Explosions();
    explosions.record(100, 100, ExplosionTier.Medium);
    explosions.advance(EffectTuning.explosionMs - 1);
    expect(explosions.active).toBe(1);
    explosions.advance(1);
    expect(explosions.active).toBe(0);
    const render = new RecordingRender();
    explosions.draw(render);
    expect(render.rects).toHaveLength(0);
  });

  it.each([
    [ExplosionTier.Small, 16, 8],
    [ExplosionTier.Medium, 32, 12],
    [ExplosionTier.Large, 56, 16],
    [ExplosionTier.Boss, 112, 24],
  ])('tier %i: %i px, %i fragments', (tier, size, fragments) => {
    const explosions = new Explosions();
    explosions.record(100, 100, tier);
    explosions.advance(150); // p = 0.5: the core is gone, fragments still 2 x 2
    const render = new RecordingRender();
    explosions.draw(render);
    expect(render.rects).toHaveLength(fragments);
    expect(fragmentsOf(render)).toBe(fragments);
    // Fragment 0 (k = 1, angle 0) sits at radius (size/2 + 6) * (1 - 0.5^2).
    const r = (size / 2 + 6) * 0.75;
    expect(render.rects[0]).toMatchObject({ x: 100 + r - 1, y: 99, w: 2, h: 2 });
    expect(render.rects[0]?.colour).toBe(Palette.explosionCool);
  });

  it('starts with a hot core of 0.55 x size, and fragments at the centre', () => {
    const explosions = new Explosions();
    explosions.record(100, 100, ExplosionTier.Large);
    const render = new RecordingRender();
    explosions.draw(render);
    const core = 56 * 0.55;
    expect(render.rects[0]).toMatchObject({
      x: 100 - core / 2,
      w: core,
      colour: Palette.explosionHot,
    });
    expect(render.rects).toHaveLength(17);
    expect(render.rects[1]).toMatchObject({ x: 99, y: 99, colour: Palette.explosionHot });
  });

  it('shrinks the boss core to 0.3 x size so the boss stays visible', () => {
    const explosions = new Explosions();
    explosions.record(100, 100, ExplosionTier.Boss);
    const render = new RecordingRender();
    explosions.draw(render);
    expect(render.rects[0]?.w).toBeCloseTo(112 * 0.3);
  });

  it('places the third-of-a-turn fragments at 0.75 of the radius, 1 x 1 after p = 0.6', () => {
    const explosions = new Explosions();
    explosions.record(0, 0, ExplosionTier.Small);
    explosions.advance(240); // p = 0.8
    const render = new RecordingRender();
    explosions.draw(render);
    const r = (8 + 6) * (1 - 0.2 * 0.2);
    const a = (1 / 8) * Math.PI * 2 + 0.2;
    expect(render.rects[1]?.x).toBeCloseTo(Math.cos(a) * r * 0.75 - 0.5);
    expect(render.rects[1]?.y).toBeCloseTo(Math.sin(a) * r * 0.75 - 0.5);
    expect(render.rects[1]?.w).toBe(1);
  });

  it('never draws white: only the two explosion colours, at every age and tier', () => {
    const explosions = new Explosions();
    for (let tier = 0; tier <= ExplosionTier.Debris; tier += 1) explosions.record(50, 50, tier);
    const colours = new Set<string>();
    for (let t = 0; t < EffectTuning.explosionMs; t += 10) {
      const render = new RecordingRender();
      explosions.draw(render);
      for (const rect of render.rects) colours.add(rect.colour);
      explosions.advance(10);
    }
    expect([...colours].sort()).toEqual([Palette.explosionCool, Palette.explosionHot].sort());
  });

  it('holds at most 16 at once, recycling the oldest first', () => {
    const explosions = new Explosions();
    for (let i = 0; i < 16; i += 1) {
      explosions.record(i * 1000, 0, 0);
      explosions.advance(10);
    }
    explosions.record(99_000, 0, 0);
    expect(explosions.active).toBe(16);
    const render = new RecordingRender();
    explosions.draw(render);
    const xs = render.rects.map((rect) => rect.x);
    expect(xs.some((x) => Math.abs(x - 99_000) < 20)).toBe(true);
    expect(xs.some((x) => Math.abs(x) < 20)).toBe(false); // the oldest, born first, was replaced
  });
});

describe('ChainLabel — the chain labels (GDD v0.32 §7.3, #147)', () => {
  it('shows nothing until a label is shown', () => {
    expect(new ChainLabel().key).toBeUndefined();
  });

  it('keeps the ×2 label 1 s, rising 8 px from y 40, then drops it', () => {
    const label = new ChainLabel();
    label.show('chainStep');
    expect(label.key).toBe('chainStep');
    expect(label.top).toBe(40);
    label.advance(500);
    expect(label.top).toBe(36);
    label.advance(499);
    expect(label.key).toBe('chainStep');
    label.advance(1);
    expect(label.key).toBeUndefined();
  });

  it('keeps the break label 0.5 s', () => {
    const label = new ChainLabel();
    label.show('chainBreak');
    label.advance(499);
    expect(label.key).toBe('chainBreak');
    label.advance(1);
    expect(label.key).toBeUndefined();
  });

  it('replaces the label on screen and restarts its life', () => {
    const label = new ChainLabel();
    label.show('chainStep');
    label.advance(900);
    label.show('chainBreak');
    expect(label.key).toBe('chainBreak');
    expect(label.top).toBe(40);
  });

  it('clears the label at once', () => {
    const label = new ChainLabel();
    label.show('chainStep');
    label.clear();
    expect(label.key).toBeUndefined();
  });
});

describe('GrazeSparks — the graze spark (GDD v0.31 §9.4, #146)', () => {
  it('draws 4 pale fragments for about 150 ms, then nothing', () => {
    const sparks = new GrazeSparks();
    sparks.record(100, 200);

    const fresh = new RecordingRender();
    sparks.draw(fresh);
    sparks.advance(EffectTuning.grazeSparkMs);
    const late = new RecordingRender();
    sparks.draw(late);

    expect(fresh.rectsOf(Palette.grazeSpark)).toHaveLength(4);
    expect(late.rectsOf(Palette.grazeSpark)).toHaveLength(0);
  });

  it('flies the fragments outward from the bullet, then dims them', () => {
    const sparks = new GrazeSparks();
    sparks.record(100, 200);
    const birth = new RecordingRender();
    sparks.draw(birth);
    sparks.advance(EffectTuning.grazeSparkMs * 0.75);

    const late = new RecordingRender();
    sparks.draw(late);

    // Fragments are 1 × 1 rectangles drawn centred: their centre is (x + 0.5, y + 0.5).
    const reach = (rects: RecordedRect[]): number[] =>
      rects.map((rect) => Math.hypot(rect.x + 0.5 - 100, rect.y + 0.5 - 200));
    const atBirth = reach(birth.rectsOf(Palette.grazeSpark));
    const dimmed = reach(late.rectsOf(Palette.grazeSparkDim));
    expect(atBirth).toHaveLength(4);
    expect(dimmed).toHaveLength(4);
    expect(late.drew(Palette.grazeSpark)).toBe(false);
    expect(Math.min(...dimmed)).toBeGreaterThan(Math.max(...atBirth));
  });

  it('never draws a white flash (GDD §9.7)', () => {
    const sparks = new GrazeSparks();
    sparks.record(10, 10);

    const render = new RecordingRender();
    sparks.draw(render);

    expect(render.drew(Palette.hitFlash)).toBe(false);
    expect(render.rects.every((rect) => rect.colour === Palette.grazeSpark)).toBe(true);
  });

  it('never ages while the frame time is 0 (frozen scenes)', () => {
    const sparks = new GrazeSparks();
    sparks.record(10, 10);
    for (let i = 0; i < 100; i += 1) sparks.advance(0);

    const render = new RecordingRender();
    sparks.draw(render);

    expect(render.rectsOf(Palette.grazeSpark)).toHaveLength(4);
  });

  it('recycles the oldest slot when every slot is live', () => {
    const sparks = new GrazeSparks();
    for (let i = 0; i <= EffectTuning.maxGrazeSparks; i += 1) sparks.record(i * 1000, 0);

    const render = new RecordingRender();
    sparks.draw(render);

    const xs = render.rectsOf(Palette.grazeSpark).map((rect) => rect.x);
    expect(xs).toHaveLength(4 * EffectTuning.maxGrazeSparks);
    expect(xs.some((x) => Math.abs(x) < 20)).toBe(false);
  });
});
