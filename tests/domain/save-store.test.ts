import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import type { Options } from '../../src/domain/options';
import type { Bindings } from '../../src/domain/ports/input-port';
import {
  DEFAULT_HIGH_SCORES,
  HighScoreTable,
  type HighScoreEntry,
} from '../../src/domain/hall-of-fame/high-scores';
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

/** Bindings a player changed: pause's secondary on keyboard, fire's secondary on gamepad. */
const CUSTOM_BINDINGS: Bindings = {
  keyboard: {
    ...DEFAULT_BINDINGS.keyboard,
    pause: { primary: 'KeyP', secondary: 'KeyC' },
  },
  gamepad: { ...DEFAULT_BINDINGS.gamepad, fire: { primary: 0, secondary: 2 } },
};

const CUSTOM: Options = {
  effects: {
    blink: false,
    hitFlash: true,
    explosions: false,
    shake: true,
    bombFlash: false,
    slowMotion: true,
    championName: true,
  },
  autofire: true,
  language: 'fr',
  fullscreen: true,
  bindings: CUSTOM_BINDINGS,
  musicVolume: 3,
  sfxVolume: 10,
};

/** The same options as a version 1 document stored them, before the bindings. */
const { bindings: _dropped, ...CUSTOM_V1 } = CUSTOM;

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
        championName: true,
      },
      autofire: false,
      language: 'en',
      fullscreen: false,
      bindings: DEFAULT_BINDINGS,
      musicVolume: 7,
      sfxVolume: 8,
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
      championName: true,
    });
  });
});

describe('SaveStore.load (ADR-0006: untrusted input, never throws)', () => {
  it('gives the defaults on a first launch, reduced motion included', () => {
    expect(new SaveStore(new MemoryStorage(), true).load()).toEqual(defaultOptions(true));
  });

  it('reads back the options it saved', () => {
    const storage = new MemoryStorage();
    const writer = new SaveStore(storage, false);
    writer.load(); // a store always reads before it writes
    expect(writer.saveOptions(CUSTOM)).toBe(true);
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
    ['a missing options object', { version: 2, highScores: [] }],
    ['a non-object effects field', { version: 2, options: { ...CUSTOM, effects: 'all' } }],
    ['an unknown language', { version: 2, options: { ...CUSTOM, language: 'de' } }],
    ['a non-boolean switch', { version: 2, options: { ...CUSTOM, autofire: 'yes' } }],
    [
      'a null champion name',
      { version: 2, options: { ...CUSTOM, effects: { ...CUSTOM.effects, championName: null } } },
    ],
    [
      'a non-boolean champion name',
      { version: 2, options: { ...CUSTOM, effects: { ...CUSTOM.effects, championName: 1 } } },
    ],
    [
      'a missing effect',
      { version: 2, options: { ...CUSTOM, effects: { ...CUSTOM.effects, shake: undefined } } },
    ],
  ])('falls back to the defaults on %s', (_label, document) => {
    expect(new SaveStore(stored(document), false).load()).toEqual(defaultOptions(false));
  });

  it('reads a document saved before the volumes with their defaults (GDD v0.23 §9.8)', () => {
    const { musicVolume: _music, sfxVolume: _sfx, ...before } = CUSTOM;
    const document = { version: 2, options: before, highScores: [] };
    const options = new SaveStore(stored(document), false).load();
    expect([options.musicVolume, options.sfxVolume]).toEqual([7, 8]);
  });

  it.each([11, -1, 2.5, '5', null])('falls back to the defaults on a volume of %j', (volume) => {
    const document = { version: 2, options: { ...CUSTOM, sfxVolume: volume }, highScores: [] };
    expect(new SaveStore(stored(document), false).load()).toEqual(defaultOptions(false));
  });

  it.each(['FR', 'none'])('reads back the country choice %j (GDD v0.26 §9.8)', (country) => {
    const document = { version: 2, options: { ...CUSTOM, country }, highScores: [] };
    expect(new SaveStore(stored(document), false).load().country).toBe(country);
  });

  it.each(['ZZ', 'fr', '', 7, null])('reads a country choice of %j as not chosen', (country) => {
    const document = { version: 2, options: { ...CUSTOM, country }, highScores: [] };
    const options = new SaveStore(stored(document), false).load();
    expect('country' in options).toBe(false);
    expect(options.musicVolume).toBe(CUSTOM.musicVolume); // the other options kept
  });

  it.each([0, 1, 42])('reads back the feedback count %j (GDD v0.26 §9.8)', (feedbackCount) => {
    const document = { version: 2, options: { ...CUSTOM, feedbackCount }, highScores: [] };
    expect(new SaveStore(stored(document), false).load().feedbackCount).toBe(feedbackCount);
  });

  it.each([-1, 2.5, '3', null, Number.MAX_SAFE_INTEGER + 2])(
    'reads a feedback count of %j as absent, keeping the other options',
    (feedbackCount) => {
      const document = { version: 2, options: { ...CUSTOM, feedbackCount }, highScores: [] };
      const options = new SaveStore(stored(document), false).load();
      expect('feedbackCount' in options).toBe(false);
      expect(options.musicVolume).toBe(CUSTOM.musicVolume);
    },
  );

  it('reads a document saved before the champion name with that switch on (GDD v0.22)', () => {
    const { championName: _new, ...before } = { ...CUSTOM.effects, championName: false };
    const document = { version: 2, options: { ...CUSTOM, effects: before }, highScores: [] };
    expect(new SaveStore(stored(document), false).load().effects.championName).toBe(true);
  });

  it('keeps only the known fields of a valid document', () => {
    const document = {
      version: 2,
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
    // A version 1 document: migrated, the bindings at their defaults.
    expect(options).toEqual({
      ...CUSTOM,
      autofire: false,
      language: 'en',
      fullscreen: false,
      bindings: DEFAULT_BINDINGS,
      musicVolume: 7,
      sfxVolume: 8,
    });
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
    const store = new SaveStore(storage, false);
    store.load();
    store.saveOptions(CUSTOM);
    expect(JSON.parse(storage.values.get(SAVE_KEY) ?? '')).toEqual({
      version: 2,
      options: CUSTOM,
      highScores: DEFAULT_HIGH_SCORES,
    });
    expect(storage.writes).toBe(1);
  });

  it('writes the stored top 10 back unchanged, so an option never erases it', () => {
    const highScores = [{ name: 'ACE', score: 1200, level: 1, date: '2026-10-14' }];
    const storage = stored({ version: 1, options: CUSTOM_V1, highScores });
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
    const storage = stored({ version: 3, options: { future: true } });
    const store = new SaveStore(storage, false);
    expect(store.load()).toEqual(defaultOptions(false));
    expect(store.saveOptions(CUSTOM)).toBe(false);
    expect(storage.writes).toBe(0);
  });
});

describe('SaveStore — version 2 and the bindings (GDD v0.15 §4.2, ADR-0006 decision 4)', () => {
  it('migrates a version 1 document: its options kept, the bindings at their defaults', () => {
    const storage = stored({ version: 1, options: CUSTOM_V1, highScores: [] });
    expect(new SaveStore(storage, false).load()).toEqual({ ...CUSTOM, bindings: DEFAULT_BINDINGS });
  });

  it('reads back custom bindings', () => {
    const storage = stored({ version: 2, options: CUSTOM, highScores: [] });
    expect(new SaveStore(storage, false).load().bindings).toEqual(CUSTOM_BINDINGS);
  });

  it('gives defaults for both devices when the bindings are missing, the options kept', () => {
    const storage = stored({ version: 2, options: CUSTOM_V1, highScores: [] });
    expect(new SaveStore(storage, false).load()).toEqual({ ...CUSTOM, bindings: DEFAULT_BINDINGS });
  });

  const keyboardWith = (pause: unknown): unknown => ({
    ...CUSTOM_BINDINGS,
    keyboard: { ...CUSTOM_BINDINGS.keyboard, pause },
  });

  it.each([
    ['a fixed key', keyboardWith({ primary: 'Escape', secondary: null })],
    ['a key outside the capturable set', keyboardWith({ primary: 'F5', secondary: null })],
    ['an empty primary', keyboardWith({ primary: null, secondary: 'KeyC' })],
    ['a key bound twice', keyboardWith({ primary: 'Space', secondary: null })],
    ['a key in both slots of an intent', keyboardWith({ primary: 'KeyC', secondary: 'KeyC' })],
    ['a number for a key', keyboardWith({ primary: 3, secondary: null })],
    [
      'a missing intent',
      { ...CUSTOM_BINDINGS, keyboard: { moveUp: { primary: 'KeyW', secondary: null } } },
    ],
    ['a non-object', { ...CUSTOM_BINDINGS, keyboard: 'KeyP' }],
  ])('restores the keyboard defaults only on %s', (_label, bindings) => {
    const storage = stored({ version: 2, options: { ...CUSTOM, bindings }, highScores: [] });
    const loaded = new SaveStore(storage, false).load();
    expect(loaded.bindings.keyboard).toEqual(DEFAULT_BINDINGS.keyboard);
    expect(loaded.bindings.gamepad).toEqual(CUSTOM_BINDINGS.gamepad);
    expect(loaded.language).toBe('fr');
  });

  it.each([
    ['button 16', 16],
    ['a fraction', 1.5],
    ['a string', 'A'],
  ])('restores the gamepad defaults only on %s', (_label, secondary) => {
    const bindings = {
      ...CUSTOM_BINDINGS,
      gamepad: { ...CUSTOM_BINDINGS.gamepad, fire: { primary: 0, secondary } },
    };
    const storage = stored({ version: 2, options: { ...CUSTOM, bindings }, highScores: [] });
    const loaded = new SaveStore(storage, false).load();
    expect(loaded.bindings.gamepad).toEqual(DEFAULT_BINDINGS.gamepad);
    expect(loaded.bindings.keyboard).toEqual(CUSTOM_BINDINGS.keyboard);
  });

  it('keeps only the known fields of the bindings', () => {
    const raw = JSON.stringify({ version: 2, options: CUSTOM, highScores: [] }).replace(
      '"pause":{',
      '"__proto__":{"primary":"KeyQ","secondary":null},"pause":{"extra":1,',
    );
    const storage = new MemoryStorage();
    storage.values.set(SAVE_KEY, raw);
    const loaded = new SaveStore(storage, false).load();
    expect(loaded.bindings).toEqual(CUSTOM_BINDINGS);
    expect(Object.getPrototypeOf(loaded.bindings.keyboard)).toBe(Object.prototype);
  });
});

describe('SaveStore — the hall of fame (GDD v0.16 §9.1, ADR-0021)', () => {
  const ACE = { name: 'ACE', country: 'FR', score: 1200, level: 1, date: '2026-10-14' } as const;

  it('reads the stored entries by allowlist, the invalid ones dropped', () => {
    const storage = stored({
      version: 2,
      options: CUSTOM,
      highScores: [ACE, { name: 'bad', score: 5, level: 1, date: '2026-10-14' }],
    });
    const store = new SaveStore(storage, false);
    store.load();
    expect(store.highScores).toEqual([ACE]);
  });

  it('saves the table with the options last loaded, and the options keep the table', () => {
    const storage = stored({ version: 2, options: CUSTOM, highScores: [] });
    const store = new SaveStore(storage, false);
    store.load();
    expect(store.saveHighScores([ACE])).toBe(true);
    expect(JSON.parse(storage.values.get(SAVE_KEY) ?? '')).toEqual({
      version: 2,
      options: CUSTOM,
      highScores: [ACE],
    });
    store.saveOptions({ ...CUSTOM, autofire: false });
    expect(JSON.parse(storage.values.get(SAVE_KEY) ?? '')).toMatchObject({ highScores: [ACE] });
  });

  it('writes nothing before the stored document has been read', () => {
    const storage = stored({ version: 2, options: CUSTOM, highScores: [ACE] });
    const store = new SaveStore(storage, false);
    expect(store.saveHighScores([])).toBe(false);
    expect(storage.writes).toBe(0);
  });

  it('falls back to the default table when a reload finds no document', () => {
    const storage = stored({ version: 2, options: CUSTOM, highScores: [ACE] });
    const store = new SaveStore(storage, false);
    store.load();
    storage.values.clear();
    store.load();
    expect(store.highScores).toEqual(DEFAULT_HIGH_SCORES);
  });

  it('never writes the table over a newer document', () => {
    const storage = stored({ version: 3, options: {} });
    const store = new SaveStore(storage, false);
    store.load();
    expect(store.saveHighScores([ACE])).toBe(false);
  });
});

describe('SaveStore — the default table (GDD v0.28 §9.1, ADR-0006 decision 5)', () => {
  const ACE: HighScoreEntry = { name: 'ACE', score: 1200, level: 1, date: '2026-10-14' };

  it.each([
    ['no save', new MemoryStorage()],
    ['an unreadable document', stored('{"version":')],
    ['a non-object document', stored(42)],
    ['an unknown version', stored({ version: 0, options: CUSTOM })],
    ['a missing version', stored({ options: CUSTOM, highScores: [ACE] })],
    ['a newer version', stored({ version: 3, options: {}, highScores: [ACE] })],
    ['a document without a highScores key', stored({ version: 2, options: CUSTOM })],
    ['a version 1 document without the key', stored({ version: 1, options: CUSTOM_V1 })],
  ])('starts with the ten fictional players on %s', (_label, storage) => {
    const store = new SaveStore(storage, false);
    store.load();
    expect(store.highScores).toEqual(DEFAULT_HIGH_SCORES);
  });

  it('starts with them when storage is unavailable', () => {
    const storage = new MemoryStorage();
    storage.available = false;
    const store = new SaveStore(storage, false);
    store.load();
    expect(store.highScores).toEqual(DEFAULT_HIGH_SCORES);
  });

  it('keeps a stored empty table empty', () => {
    const store = new SaveStore(stored({ version: 2, options: CUSTOM, highScores: [] }), false);
    store.load();
    expect(store.highScores).toEqual([]);
  });

  it.each([null, 'x', {}, [{ bad: 1 }]])(
    'reads a present but unusable highScores (%j) as a stored empty table',
    (highScores) => {
      const store = new SaveStore(stored({ version: 2, options: CUSTOM, highScores }), false);
      store.load();
      expect(store.highScores).toEqual([]);
    },
  );

  it('keeps a stored table although the options are invalid', () => {
    const document = { version: 2, options: { language: 'xx' }, highScores: [ACE] };
    const store = new SaveStore(stored(document), false);
    store.load();
    expect(store.highScores).toEqual([ACE]);
  });

  it('keeps a stored table as stored, without the fictional rows', () => {
    const store = new SaveStore(stored({ version: 2, options: CUSTOM, highScores: [ACE] }), false);
    store.load();
    expect(store.highScores).toEqual([ACE]);
  });

  it('shows the defaults in a session that read a newer save, and never writes it', () => {
    const storage = stored({ version: 3, options: {} });
    const store = new SaveStore(storage, false);
    store.load();
    expect(store.highScores).toEqual(DEFAULT_HIGH_SCORES);
    expect(store.saveHighScores([ACE])).toBe(false);
    expect(storage.writes).toBe(0);
  });

  it('writes the whole table, fictional rows included, with the first real entry', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage, false);
    store.load();
    const table = new HighScoreTable(store.highScores);
    table.insert({ name: 'ME', score: 95000, level: 1, date: '2026-10-22' });
    store.saveHighScores(table.entries);
    const written = JSON.parse(storage.values.get(SAVE_KEY) ?? '') as { highScores: unknown[] };
    expect(written.highScores).toHaveLength(10);
    expect(written.highScores).toContainEqual(expect.objectContaining({ name: 'ME' }));
    expect(written.highScores).not.toContainEqual(expect.objectContaining({ name: 'KITE' }));
  });
});
