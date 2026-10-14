import type { Language } from '../i18n/messages';
import type { StoragePort } from '../ports/storage-port';
import type { EffectSettings } from '../presentation/run-presenter';

/** The one key of the save document (ADR-0006 decision 2, GDD §9.8). */
export const SAVE_KEY = 'retro-shmup.v1';

const VERSION = 1;

/** The player's options (GDD v0.13 §9.3); the remap (G1b) and the volumes (G3) come later. */
export interface Options {
  readonly effects: Readonly<EffectSettings>;
  /** Touch and mouse fire all the time (ADR-0020 decision 4). */
  readonly autofire: boolean;
  readonly language: Language;
  readonly fullscreen: boolean;
}

const LANGUAGES: readonly Language[] = ['en', 'fr'];

/**
 * The options of a first launch (GDD §9.3): every effect on, except that reduced motion presets
 * the shake, the flashes and the slow motion off. The blink stays on until its non-flashing form
 * exists (interim, meta/05-state-scenes).
 */
export function defaultOptions(reducedMotion: boolean): Options {
  return {
    effects: {
      blink: true,
      hitFlash: !reducedMotion,
      explosions: true,
      shake: !reducedMotion,
      bombFlash: !reducedMotion,
      slowMotion: !reducedMotion,
    },
    autofire: false,
    language: 'en',
    fullscreen: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rebuilds the effects from the known keys only; `undefined` if any is not a boolean. */
function parseEffects(value: unknown): EffectSettings | undefined {
  if (!isRecord(value)) return undefined;
  const { blink, hitFlash, explosions, shake, bombFlash, slowMotion } = value;
  if (
    typeof blink !== 'boolean' ||
    typeof hitFlash !== 'boolean' ||
    typeof explosions !== 'boolean' ||
    typeof shake !== 'boolean' ||
    typeof bombFlash !== 'boolean' ||
    typeof slowMotion !== 'boolean'
  ) {
    return undefined;
  }
  return { blink, hitFlash, explosions, shake, bombFlash, slowMotion };
}

/** Allowlist parsing (ADR-0006, INPUT-1): a new object of the known fields, or `undefined`. */
function parseOptions(value: unknown): Options | undefined {
  if (!isRecord(value)) return undefined;
  const effects = parseEffects(value.effects);
  const { autofire, fullscreen, language } = value;
  if (effects === undefined) return undefined;
  if (typeof autofire !== 'boolean' || typeof fullscreen !== 'boolean') return undefined;
  const known = LANGUAGES.find((candidate) => candidate === language);
  if (known === undefined) return undefined;
  return { effects, autofire, language: known, fullscreen };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined; // An unreadable document resolves to the defaults (ADR-0006 decision 4).
  }
}

/**
 * The save document's schema rules (ADR-0006, meta/04-class-menus): `StoragePort` moves strings,
 * this reads and writes the versioned document. Untrusted input: parsing never throws, and an
 * unreadable, invalid or unknown document resolves to the defaults. Reads and writes happen at
 * discrete moments only, never inside the fixed step.
 */
export class SaveStore {
  private readonly storage: StoragePort;
  private readonly reducedMotion: boolean;
  /** A newer document read by an older build is never overwritten this session (UC4 2c). */
  private readOnly = false;
  /**
   * The stored top 10, kept as read so saving an option never erases it; the hall of fame (G2)
   * validates its entries (ADR-0021) when it reads them.
   */
  private highScores: readonly unknown[] = [];

  constructor(storage: StoragePort, reducedMotion: boolean) {
    this.storage = storage;
    this.reducedMotion = reducedMotion;
  }

  /** The stored options, or the defaults of a first launch. */
  load(): Options {
    const raw = this.storage.read(SAVE_KEY);
    const fallback = defaultOptions(this.reducedMotion);
    if (raw === null) return fallback;
    const document = parseJson(raw);
    if (!isRecord(document)) return fallback;
    const version = document.version;
    if (typeof version === 'number' && version > VERSION) {
      this.readOnly = true;
      return fallback;
    }
    if (version !== VERSION) return fallback;
    if (Array.isArray(document.highScores)) this.highScores = document.highScores;
    return parseOptions(document.options) ?? fallback;
  }

  /**
   * Writes the whole document once; `false` when storage is unavailable or the stored document
   * is newer: the session goes on without saving. The stored top 10 is written back unchanged.
   */
  saveOptions(options: Options): boolean {
    if (this.readOnly) return false;
    const document = { version: VERSION, options, highScores: this.highScores };
    return this.storage.write(SAVE_KEY, JSON.stringify(document));
  }
}
