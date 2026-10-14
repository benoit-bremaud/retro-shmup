import { describe, expect, it } from 'vitest';
import type { Options } from '../../src/domain/options';
import { defaultOptions, SAVE_KEY, SaveStore } from '../../src/domain/save/save-store';
import type { StoragePort } from '../../src/domain/ports/storage-port';

/** An in-memory storage; `available: false` behaves like a browser that refuses storage. */
class MemoryStorage implements StoragePort {
  readonly values = new Map<string, string>();
  available = true;
  writes = 0;

  read(key: string): string | null {
    if (!this.available) return null;
    return this.values.get(key) ?? null;
  }

  write(key: string, value: string): boolean {
    if (!this.available) return false;
    this.writes += 1;
    this.values.set(key, value);
    return true;
  }
}

function stored(document: unknown): MemoryStorage {
  const storage = new MemoryStorage();
  storage.values.set(SAVE_KEY, JSON.stringify(document));
  return storage;
}

const CUSTOM: Options = {
  effects: {
    blink: false,
    hitFlash: true,
    explosions: false,
    shake: true,
    bombFlash: false,
    slowMotion: true,
  },
  autofire: true,
  language: 'fr',
  fullscreen: true,
};

describe('defaultOptions (GDD §9.3)', () => {
  it('turns every effect on, autofire and fullscreen off, English', () => {
    expect(defaultOptions(false)).toEqual({
      effects: {
        blink: true,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
      },
      autofire: false,
      language: 'en',
      fullscreen: false,
    });
  });

  it('presets the flashing and moving effects off under reduced motion', () => {
    // The blink stays on until its non-flashing form exists (interim, meta/05-state-scenes).
    expect(defaultOptions(true).effects).toEqual({
      blink: true,
      hitFlash: false,
      explosions: true,
      shake: false,
      bombFlash: false,
      slowMotion: false,
    });
  });
});

describe('SaveStore.load (ADR-0006: untrusted input, never throws)', () => {
  it('gives the defaults on a first launch, reduced motion included', () => {
    expect(new SaveStore(new MemoryStorage(), true).load()).toEqual(defaultOptions(true));
  });

  it('reads back the options it saved', () => {
    const storage = new MemoryStorage();
    expect(new SaveStore(storage, false).saveOptions(CUSTOM)).toBe(true);
    // A stored document wins over reduced motion: it only presets a first launch.
    expect(new SaveStore(storage, true).load()).toEqual(CUSTOM);
  });

  it.each([
    ['invalid JSON', '{"version":'],
    ['a non-object', '42'],
    ['null', 'null'],
    ['an array', '[]'],
  ])('falls back to the defaults on %s', (_label, raw) => {
    const storage = new MemoryStorage();
    storage.values.set(SAVE_KEY, raw);
    expect(new SaveStore(storage, false).load()).toEqual(defaultOptions(false));
  });

  it.each([
    ['a missing version', { options: CUSTOM, highScores: [] }],
    ['a missing options object', { version: 1, highScores: [] }],
    ['an unknown language', { version: 1, options: { ...CUSTOM, language: 'de' } }],
    ['a non-boolean switch', { version: 1, options: { ...CUSTOM, autofire: 'yes' } }],
    [
      'a missing effect',
      { version: 1, options: { ...CUSTOM, effects: { ...CUSTOM.effects, shake: undefined } } },
    ],
  ])('falls back to the defaults on %s', (_label, document) => {
    expect(new SaveStore(stored(document), false).load()).toEqual(defaultOptions(false));
  });

  it('keeps only the known fields of a valid document', () => {
    const document = {
      version: 1,
      options: { ...CUSTOM, extra: '<script>', effects: { ...CUSTOM.effects, extra: true } },
      highScores: [],
    };
    expect(new SaveStore(stored(document), false).load()).toEqual(CUSTOM);
  });

  it.each([
    ['a string version', '1'],
    ['an older version', 0],
  ])('falls back to the defaults on %s, and stays writable', (_label, version) => {
    const storage = stored({ version, options: CUSTOM, highScores: [] });
    const store = new SaveStore(storage, false);
    expect(store.load()).toEqual(defaultOptions(false));
    expect(store.saveOptions(CUSTOM)).toBe(true);
  });

  it('stays writable after a damaged document', () => {
    const storage = new MemoryStorage();
    storage.values.set(SAVE_KEY, '{"version":');
    const store = new SaveStore(storage, false);
    store.load();
    expect(store.saveOptions(CUSTOM)).toBe(true);
    expect(new SaveStore(storage, false).load()).toEqual(CUSTOM);
  });

  it('never lets a "__proto__" key reach an object prototype', () => {
    const raw = `{"version":1,"options":{"__proto__":{"autofire":true},"effects":${JSON.stringify(
      CUSTOM.effects,
    )},"autofire":false,"language":"en","fullscreen":false}}`;
    const storage = new MemoryStorage();
    storage.values.set(SAVE_KEY, raw);
    const options = new SaveStore(storage, false).load();
    expect(options).toEqual({ ...CUSTOM, autofire: false, language: 'en', fullscreen: false });
    expect(Object.getPrototypeOf(options)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).autofire).toBeUndefined();
  });

  it('gives the defaults when storage is unavailable', () => {
    const storage = new MemoryStorage();
    storage.available = false;
    expect(new SaveStore(storage, false).load()).toEqual(defaultOptions(false));
  });
});

describe('SaveStore.saveOptions (ADR-0006 decisions 2, 5, 6)', () => {
  it('writes one versioned document under the one key', () => {
    const storage = new MemoryStorage();
    new SaveStore(storage, false).saveOptions(CUSTOM);
    expect(JSON.parse(storage.values.get(SAVE_KEY) ?? '')).toEqual({
      version: 1,
      options: CUSTOM,
      highScores: [],
    });
    expect(storage.writes).toBe(1);
  });

  it('writes the stored top 10 back unchanged, so an option never erases it', () => {
    const highScores = [{ name: 'ACE', score: 1200, level: 1, date: '2026-10-14' }];
    const storage = stored({ version: 1, options: CUSTOM, highScores });
    const store = new SaveStore(storage, false);
    store.load();
    store.saveOptions({ ...CUSTOM, autofire: false });
    expect(JSON.parse(storage.values.get(SAVE_KEY) ?? '')).toMatchObject({ highScores });
  });

  it('reports false when storage is unavailable, and the session goes on', () => {
    const storage = new MemoryStorage();
    storage.available = false;
    expect(new SaveStore(storage, false).saveOptions(CUSTOM)).toBe(false);
  });

  it('never overwrites a newer document read by an older build', () => {
    const storage = stored({ version: 2, options: { future: true } });
    const store = new SaveStore(storage, false);
    expect(store.load()).toEqual(defaultOptions(false));
    expect(store.saveOptions(CUSTOM)).toBe(false);
    expect(storage.writes).toBe(0);
  });
});
