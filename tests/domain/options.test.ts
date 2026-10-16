import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import { LiveOptions } from '../../src/domain/options';
import type { Options } from '../../src/domain/options';

const SAVED: Options = {
  effects: {
    blink: true,
    hitFlash: true,
    explosions: true,
    shake: true,
    bombFlash: true,
    slowMotion: true,
    championName: true,
  },
  autofire: false,
  language: 'en',
  fullscreen: false,
  bindings: DEFAULT_BINDINGS,
};

describe('LiveOptions (GDD v0.14 §9.3, meta/04-class-menus)', () => {
  it('copies the saved options, so a change never reaches the saved object', () => {
    const live = new LiveOptions(SAVED);
    live.apply('shake');
    expect(SAVED.effects.shake).toBe(true);
    expect(live.effects.shake).toBe(false);
  });

  it('toggles the language back from French to English', () => {
    const live = new LiveOptions({ ...SAVED, language: 'fr' });
    expect(live.apply('language')).toBe(true);
    expect(live.value('language')).toBe('english');
  });

  it('shows no value on a row without one, and ignores its activation', () => {
    const live = new LiveOptions(SAVED);
    expect(live.value('back')).toBeUndefined();
    expect(live.apply('back')).toBe(false);
  });

  it.each([
    ['autofire', 'off', 'on'],
    ['fullscreen', 'off', 'on'],
    ['language', 'english', 'francais'],
    ['hitFlash', 'on', 'off'],
  ] as const)('flips %s from %s to %s', (row, before, after) => {
    const live = new LiveOptions(SAVED);
    expect(live.value(row)).toBe(before);
    expect(live.apply(row)).toBe(true);
    expect(live.value(row)).toBe(after);
  });

  it('sets every effect with All off and All on', () => {
    const live = new LiveOptions(SAVED);
    live.apply('allOff');
    expect(Object.values(live.effects).every((on) => !on)).toBe(true);
    live.apply('allOn');
    expect(Object.values(live.effects).every((on) => on)).toBe(true);
  });

  it('shows no value and changes nothing for a row without one', () => {
    const live = new LiveOptions(SAVED);
    expect(live.value('back')).toBeUndefined();
    expect(live.apply('back')).toBe(false);
  });

  it('serialises as plain options for the save document', () => {
    expect(JSON.parse(JSON.stringify(new LiveOptions(SAVED)))).toEqual(SAVED);
  });
});
