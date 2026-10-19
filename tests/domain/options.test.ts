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
  musicVolume: 7,
  sfxVolume: 8,
};

describe('LiveOptions (GDD v0.14 §9.3, meta/04-class-menus)', () => {
  it('copies the saved options, so a change never reaches the saved object', () => {
    const live = new LiveOptions(SAVED);
    live.apply('shake');
    expect(SAVED.effects.shake).toBe(true);
    expect(live.effects.shake).toBe(false);
  });

  it('shows the volumes as steps, adds one on an activation and nudges them (GDD v0.23)', () => {
    const live = new LiveOptions(SAVED);
    expect([live.value('music'), live.value('soundEffects')]).toEqual([7, 8]);
    expect(live.apply('music')).toBe(true);
    live.nudge('soundEffects', -1);
    live.nudge('music', 1);
    expect([live.musicVolume, live.sfxVolume]).toEqual([9, 7]);
  });

  it('counts a feedback opening from absent, then on, without touching the saved object', () => {
    const live = new LiveOptions(SAVED);
    expect(live.feedbackCount).toBeUndefined();
    live.countFeedback();
    live.countFeedback();
    expect(live.feedbackCount).toBe(2);
    expect(SAVED.feedbackCount).toBeUndefined();
  });

  it('continues from the saved feedback count', () => {
    const live = new LiveOptions({ ...SAVED, feedbackCount: 4 });
    live.countFeedback();
    expect(live.feedbackCount).toBe(5);
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
