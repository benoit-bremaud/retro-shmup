import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import type { Options } from '../../src/domain/options';
import { NO_HOST } from '../../src/domain/scenes/scene-host';

describe('NO_HOST (the tests’ default host)', () => {
  it('answers every capture poll with a cancellation', () => {
    expect(NO_HOST.captureNext()).toEqual({ kind: 'cancelled' });
  });

  it('knows no key label, no country and a fixed date', () => {
    expect(NO_HOST.keyLabel('KeyA')).toBe('');
    expect(NO_HOST.preselectedCountry()).toBeUndefined();
    expect(NO_HOST.today()).toBe('2026-01-01');
  });

  it('accepts every notification and command without a result', () => {
    const options: Options = {
      effects: {
        blink: true,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
        championName: true,
        graze: true,
        chainHints: true,
      },
      autofire: false,
      language: 'en',
      fullscreen: false,
      bindings: DEFAULT_BINDINGS,
      musicVolume: 7,
      sfxVolume: 8,
    };
    expect(() => {
      NO_HOST.optionsChanged(options);
      NO_HOST.releaseMovement();
      NO_HOST.startCapture('keyboard');
      NO_HOST.cancelCapture();
      NO_HOST.highScoresChanged([]);
    }).not.toThrow();
    // Inert: nothing it was told changes what it answers.
    expect(NO_HOST.captureNext()).toEqual({ kind: 'cancelled' });
  });
});
