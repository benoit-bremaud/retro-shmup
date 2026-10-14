import type { Language } from '../i18n/messages';
import { REMAPPABLE_INTENTS } from '../input/bindings-editor';
import { isCapturableButton, isCapturableKey } from '../input/capturable';
import { DEFAULT_BINDINGS } from '../input/default-bindings';
import type { EffectSettings, Options } from '../options';
import type { BindingSlots, Bindings, RemappableIntent } from '../ports/input-port';
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

function isKey(value: unknown): value is string {
  return typeof value === 'string' && isCapturableKey(value);
}

function isButton(value: unknown): value is number {
  return typeof value === 'number' && isCapturableButton(value);
}

/**
 * One device's slots, rebuilt from the known intents only (GDD v0.15 §4.2): every input from the
 * capturable set, a primary always present, no input bound twice; `undefined` otherwise.
 */
function parseDevice<T>(
  value: unknown,
  accepts: (input: unknown) => input is T,
): Record<RemappableIntent, BindingSlots<T>> | undefined {
  if (!isRecord(value)) return undefined;
  const parsed: Partial<Record<RemappableIntent, BindingSlots<T>>> = {};
  const seen = new Set<T>();
  for (let i = 0; i < REMAPPABLE_INTENTS.length; i += 1) {
    const intent = REMAPPABLE_INTENTS[i];
    if (intent === undefined) continue;
    const slots = value[intent];
    if (!isRecord(slots)) return undefined;
    const { primary, secondary } = slots;
    if (!accepts(primary) || seen.has(primary)) return undefined;
    seen.add(primary);
    if (secondary !== null && (!accepts(secondary) || seen.has(secondary))) return undefined;
    if (secondary !== null) seen.add(secondary);
    parsed[intent] = { primary, secondary };
  }
  return complete(parsed);
}

/** The record once every intent is in it (the loop above fills them all or returns early). */
function complete<T>(
  parsed: Partial<Record<RemappableIntent, BindingSlots<T>>>,
): Record<RemappableIntent, BindingSlots<T>> | undefined {
  const { moveUp, moveDown, moveLeft, moveRight, fire, bomb, pause } = parsed;
  if (
    moveUp === undefined ||
    moveDown === undefined ||
    moveLeft === undefined ||
    moveRight === undefined ||
    fire === undefined ||
    bomb === undefined ||
    pause === undefined
  ) {
    return undefined;
  }
  return { moveUp, moveDown, moveLeft, moveRight, fire, bomb, pause };
}

/** Both devices' bindings; a device that fails any check gets its defaults back. */
function parseBindings(value: unknown): Bindings {
  const devices = isRecord(value) ? value : {};
  return {
    keyboard: parseDevice(devices.keyboard, isKey) ?? DEFAULT_BINDINGS.keyboard,
    gamepad: parseDevice(devices.gamepad, isButton) ?? DEFAULT_BINDINGS.gamepad,
  };
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
    if (version !== VERSION && version !== FIRST_VERSION) return fallback;
    if (Array.isArray(document.highScores)) this.highScores = document.highScores;
    return parseOptions(document.options, version) ?? fallback;
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
