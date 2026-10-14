import type { Language } from '../i18n/messages';
import { isRecord } from '../guards';
import { parseHighScores } from '../hall-of-fame/high-scores';
import type { HighScoreEntry } from '../hall-of-fame/high-scores';
import { DEFAULT_BINDINGS } from '../input/default-bindings';
import { parseBindings } from '../input/parse-bindings';
import type { EffectSettings, Options } from '../options';
import type { StoragePort } from '../ports/storage-port';

/** The one key of the save document (ADR-0006 decision 2, GDD §9.8). */
export const SAVE_KEY = 'retro-shmup.v1';

/** Version 2 adds the bindings (GDD v0.15 §4.2); version 1 migrates by adding the defaults. */
const VERSION = 2;
const FIRST_VERSION = 1;

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
    bindings: DEFAULT_BINDINGS,
  };
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

/**
 * Allowlist parsing (ADR-0006, INPUT-1): a new object of the known fields, or `undefined`. A
 * version 1 document has no bindings: it migrates with the defaults (ADR-0006 decision 4).
 */
function parseOptions(value: unknown, version: number): Options | undefined {
  if (!isRecord(value)) return undefined;
  const effects = parseEffects(value.effects);
  const { autofire, fullscreen, language } = value;
  if (effects === undefined) return undefined;
  if (typeof autofire !== 'boolean' || typeof fullscreen !== 'boolean') return undefined;
  const known = LANGUAGES.find((candidate) => candidate === language);
  if (known === undefined) return undefined;
  const bindings = version === FIRST_VERSION ? DEFAULT_BINDINGS : parseBindings(value.bindings);
  return { effects, autofire, language: known, fullscreen, bindings };
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
  /** The stored top 10, read by allowlist (ADR-0021); saving an option writes it back. */
  private table: readonly HighScoreEntry[] = [];
  /** The options last loaded or saved, written with the table. */
  private options: Options;

  constructor(storage: StoragePort, reducedMotion: boolean) {
    this.storage = storage;
    this.reducedMotion = reducedMotion;
    this.options = defaultOptions(reducedMotion);
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
    if (version !== VERSION && version !== FIRST_VERSION) return fallback;
    this.table = parseHighScores(document.highScores);
    this.options = parseOptions(document.options, version) ?? fallback;
    return this.options;
  }

  /**
   * Writes the whole document once; `false` when storage is unavailable or the stored document
   * is newer: the session goes on without saving. The stored top 10 is written back unchanged.
   */
  saveOptions(options: Options): boolean {
    this.options = options;
    return this.write();
  }

  /** The top 10 read by `load`, best first. */
  get highScores(): readonly HighScoreEntry[] {
    return this.table;
  }

  /** Writes the new top 10 with the options last saved or loaded (GDD v0.16 §9.1). */
  saveHighScores(entries: readonly HighScoreEntry[]): boolean {
    this.table = entries;
    return this.write();
  }

  private write(): boolean {
    if (this.readOnly) return false;
    const document = { version: VERSION, options: this.options, highScores: this.table };
    return this.storage.write(SAVE_KEY, JSON.stringify(document));
  }
}
