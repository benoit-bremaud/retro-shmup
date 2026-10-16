import { describe, expect, it } from 'vitest';
import { SFX_TABLE, Sfx, UI_SOUNDS } from '../../src/domain/audio/sfx';
import { renderSfx, Wave } from '../../src/domain/audio/synth';
import type { SfxParams } from '../../src/domain/audio/synth';
import { SILENT_AUDIO } from '../../src/domain/ports/audio-port';
import { DefaultVolume, MAX_VOLUME_STEP, volumeGain } from '../../src/domain/audio/volume';

const RATE = 8000;

function params(overrides: Partial<SfxParams> = {}): SfxParams {
  return {
    wave: Wave.Square,
    frequency: 440,
    slide: 0,
    duty: 0.5,
    vibratoDepth: 0,
    vibratoRate: 0,
    attack: 0.01,
    sustain: 0.02,
    decay: 0.02,
    lowPass: 1,
    gain: 1,
    seed: 1,
    ...overrides,
  };
}

function peak(samples: Float32Array): number {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  return max;
}

describe('renderSfx (GDD v0.23 §9.5)', () => {
  it('renders attack + sustain + decay seconds of samples', () => {
    expect(renderSfx(params(), RATE)).toHaveLength(400);
  });

  it('renders at least one sample for an empty row', () => {
    expect(renderSfx(params({ attack: 0, sustain: 0, decay: 0 }), RATE)).toHaveLength(1);
  });

  it.each([Wave.Square, Wave.Saw, Wave.Sine, Wave.Noise])(
    'keeps wave %i within [-1, 1]',
    (wave) => {
      const samples = renderSfx(
        params({ wave, slide: -20_000, vibratoDepth: 0.5, vibratoRate: 9 }),
        RATE,
      );
      expect(peak(samples)).toBeLessThanOrEqual(1);
      expect(peak(samples)).toBeGreaterThan(0);
    },
  );

  it('starts silent under an attack and ends near silence after the decay', () => {
    const samples = renderSfx(params(), RATE);
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples[samples.length - 1] ?? 1)).toBeLessThan(0.01);
  });

  it('holds full level in the sustain of a square', () => {
    const samples = renderSfx(params({ attack: 0, lowPass: 1 }), RATE);
    expect(Math.abs(samples[10] ?? 0)).toBe(1);
  });

  it('cuts at the end of the sustain when there is no decay', () => {
    const samples = renderSfx(params({ attack: 0, sustain: 0.01, decay: 0 }), RATE);
    expect(samples).toHaveLength(80);
    expect(Math.abs(samples[79] ?? 0)).toBe(1);
  });

  it('scales by the gain', () => {
    expect(peak(renderSfx(params({ attack: 0, gain: 0.25 }), RATE))).toBeCloseTo(0.25);
  });

  it('smooths with the low-pass', () => {
    const sharp = renderSfx(params({ attack: 0, frequency: 2000 }), RATE);
    const soft = renderSfx(params({ attack: 0, frequency: 2000, lowPass: 0.1 }), RATE);
    expect(peak(soft)).toBeLessThan(peak(sharp));
  });

  it('gives the same noise for the same seed and other noise for another (ADR-0002)', () => {
    const noise = params({ wave: Wave.Noise });
    expect(renderSfx(noise, RATE)).toEqual(renderSfx(noise, RATE));
    expect(renderSfx(noise, RATE)).not.toEqual(renderSfx({ ...noise, seed: 2 }, RATE));
  });
});

describe('the sound table (GDD v0.23 §9.5)', () => {
  it('has one row for every sound, each rendering within [-1, 1]', () => {
    const ids = Object.values(Sfx);
    expect(Object.keys(SFX_TABLE).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(peak(renderSfx(SFX_TABLE[id], RATE))).toBeLessThanOrEqual(1);
  });

  it('keeps the player shots lowest in the mix', () => {
    const others = Object.values(Sfx).filter((id) => id !== Sfx.ShotSpread && id !== Sfx.ShotLaser);
    const lowest = Math.min(...others.map((id) => SFX_TABLE[id].gain));
    expect(SFX_TABLE.shotSpread.gain).toBeLessThan(lowest);
    expect(SFX_TABLE.shotLaser.gain).toBeLessThan(lowest);
  });

  it('names the menu sounds only as UI sounds', () => {
    expect(UI_SOUNDS).toEqual([Sfx.MenuMove, Sfx.MenuConfirm]);
  });
});

describe('volumeGain (GDD v0.23 §9.3)', () => {
  it.each([
    [0, 0],
    [5, 0.25],
    [MAX_VOLUME_STEP, 1],
  ])('maps step %i to (step / 10)² = %f', (step, gain) => {
    expect(volumeGain(step)).toBeCloseTo(gain);
  });

  it('defaults to music 7 and sound effects 8', () => {
    expect(DefaultVolume).toEqual({ music: 7, sfx: 8 });
  });
});

describe('SILENT_AUDIO', () => {
  it('accepts every call and does nothing', () => {
    expect(() => {
      SILENT_AUDIO.play(Sfx.Hit);
      SILENT_AUDIO.music(null);
      SILENT_AUDIO.setVolumes(1, 1);
      SILENT_AUDIO.setPaused(true);
    }).not.toThrow();
  });
});
