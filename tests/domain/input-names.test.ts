import { describe, expect, it } from 'vitest';
import { buttonName, keyName } from '../../src/domain/input/input-names';

/** The adapter's answer for letter and digit keys; `''` for the others. */
const azerty = (code: string): string => ({ KeyQ: 'A', Digit1: '1' })[code] ?? '';

describe('keyName (GDD v0.15 §4.2)', () => {
  it('shows the character the layout prints for a letter or digit key', () => {
    expect(keyName('KeyQ', 'en', azerty)).toBe('A');
    expect(keyName('Digit1', 'fr', azerty)).toBe('1');
  });

  it.each([
    ['Space', 'en', 'SPACE'],
    ['Space', 'fr', 'ESPACE'],
    ['ShiftLeft', 'fr', 'MAJ G'],
    ['ControlRight', 'en', 'CTRL R'],
    ['AltLeft', 'fr', 'ALT G'],
    ['Backspace', 'fr', 'EFFACER'],
    ['ArrowUp', 'en', '↑'],
    ['ArrowLeft', 'fr', '←'],
    ['Numpad7', 'fr', 'NUM 7'],
  ] as const)('names %s in %s as %s', (code, language, name) => {
    expect(keyName(code, language, azerty)).toBe(name);
  });

  it('gives every capturable name in 10 characters at most', () => {
    const codes = [
      'Space',
      'ShiftLeft',
      'ShiftRight',
      'ControlLeft',
      'ControlRight',
      'AltLeft',
      'AltRight',
      'Backspace',
      'Numpad0',
    ];
    for (const language of ['en', 'fr'] as const) {
      for (const code of codes)
        expect(keyName(code, language, azerty).length).toBeLessThanOrEqual(10);
    }
  });

  it('returns the same string each call, so a draw builds none', () => {
    expect(keyName('Numpad3', 'en', azerty)).toBe(keyName('Numpad3', 'en', azerty));
  });
});

describe('buttonName (GDD v0.15 §4.2)', () => {
  it.each([
    [0, 'A'],
    [1, 'B'],
    [4, 'LB'],
    [7, 'RT'],
    [8, 'SELECT'],
    [9, 'START'],
    [11, 'R3'],
    [12, '↑'],
    [15, '→'],
  ])('names button %i %s', (index, name) => {
    expect(buttonName(index)).toBe(name);
  });

  it('gives no name outside the standard buttons 0 to 15', () => {
    expect(buttonName(16)).toBe('');
  });
});
