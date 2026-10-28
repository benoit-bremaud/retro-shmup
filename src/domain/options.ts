import { cycleVolume, nudgeVolume } from './audio/volume';
import type { Language, MessageKey } from './i18n/messages';
import type { Bindings } from './ports/input-port';

/**
 * Game-feel switches the presenter honours (GDD §9.3, §9.4), one per effect drawn so far. Neutral
 * ground: the presenter reads them, the save document stores them, the options screen sets them.
 */
export interface EffectSettings {
  blink: boolean;
  hitFlash: boolean;
  explosions: boolean;
  /** The bomb's field shake (GDD v0.8 §9.3, §9.4). */
  shake: boolean;
  /** The bomb's tint of the field. */
  bombFlash: boolean;
  /** Half speed for 0.5 s after the boss's death (GDD v0.10 §9.3, §9.4): its own switch. */
  slowMotion: boolean;
  /** The hall-of-fame number 1's name in the far background (GDD v0.22 §9.4.1). */
  championName: boolean;
  /** The graze spark (GDD v0.31 §9.4): the graze still scores with it off. */
  graze: boolean;
  /** The chain labels (GDD v0.32 §7.3): the chain works the same with it off. */
  chainHints: boolean;
}

/** The saved choice that stands for *NONE*: no country (GDD v0.26 §9.8). */
export const NO_COUNTRY = 'none';

/** A row value shown as is, not through the catalogue: the country code. */
export interface TextValue {
  readonly text: string;
  /** The text is a country code drawn with its flag (GDD v0.27 §9.3). */
  readonly flag?: boolean;
}

/** What the *Country* row shows for no choice or *NONE* (GDD v0.26 §9.3). */
const NO_CODE: TextValue = { text: '--' };

/** One value per code, built at its first draw: the allowlist bounds it, and no draw allocates twice. */
const CODE_VALUES = new Map<string, TextValue>();

function countryValue(choice: string | undefined): TextValue {
  if (choice === undefined || choice === NO_COUNTRY) return NO_CODE;
  let value = CODE_VALUES.get(choice);
  if (value === undefined) {
    value = { text: choice, flag: true };
    CODE_VALUES.set(choice, value);
  }
  return value;
}

/** The player's options (GDD v0.13 §9.3, v0.15 §4.2, v0.23 the volumes, v0.26 the country). */
export interface Options {
  readonly effects: Readonly<EffectSettings>;
  /** Touch and mouse fire all the time (ADR-0020 decision 4). */
  readonly autofire: boolean;
  readonly language: Language;
  readonly fullscreen: boolean;
  /** Both devices' slots (ADR-0012), replaced whole by each rebinding. */
  readonly bindings: Bindings;
  /** The volume steps, 0 to 10 (GDD v0.23 §9.3). */
  readonly musicVolume: number;
  readonly sfxVolume: number;
  /**
   * A code of `COUNTRY_CODES` or `NO_COUNTRY`; absent until the player first chooses (GDD v0.26
   * §9.1, §9.8, ADR-0027 decision 6).
   */
  readonly country?: string | undefined;
  /**
   * How many times the feedback form was opened, a whole number; absent reads as 0 (GDD v0.26
   * §9.8, ADR-0027 decision 4).
   */
  readonly feedbackCount?: number | undefined;
}

/** The *Audio* sub-screen's value rows (GDD v0.23 §9.3). */
export type VolumeRow = 'music' | 'soundEffects';

/** What a value row shows: a catalogue key (a switch, a choice), a volume step or a code. */
export type RowValue = MessageKey | number | TextValue;

/** The effect switches, in screen order; each row's message key is its `EffectSettings` key. */
export const EFFECT_ROWS = [
  'blink',
  'hitFlash',
  'explosions',
  'shake',
  'bombFlash',
  'slowMotion',
  'championName',
  'graze',
  'chainHints',
] as const satisfies readonly (keyof EffectSettings & MessageKey)[];
type EffectRow = (typeof EFFECT_ROWS)[number];

function isEffectRow(row: MessageKey): row is EffectRow {
  return (EFFECT_ROWS as readonly MessageKey[]).includes(row);
}

function onOff(on: boolean): MessageKey {
  return on ? 'on' : 'off';
}

/**
 * The options while the game runs (GDD v0.14 §9.3, meta/04-class-menus): what each options or
 * visual-effects row shows and what activating it changes. The presenter reads `effects` itself,
 * so a switch applies at the next frame. Plain fields, so the save store serialises it as is;
 * whoever is handed it reads it at once and keeps no reference.
 */
export class LiveOptions implements Options {
  readonly effects: EffectSettings;
  autofire: boolean;
  language: Language;
  fullscreen: boolean;
  /** Immutable: each rebinding replaces it (GDD v0.15 §4.2). */
  bindings: Bindings;
  musicVolume: number;
  sfxVolume: number;
  country: string | undefined;
  feedbackCount: number | undefined;

  /** A copy of the saved options. */
  constructor(saved: Readonly<Options>) {
    this.effects = { ...saved.effects };
    this.autofire = saved.autofire;
    this.language = saved.language;
    this.fullscreen = saved.fullscreen;
    this.bindings = saved.bindings;
    this.musicVolume = saved.musicVolume;
    this.sfxVolume = saved.sfxVolume;
    this.country = saved.country;
    this.feedbackCount = saved.feedbackCount;
  }

  /** One more opening of the feedback form: the next one shows the next question set. */
  countFeedback(): void {
    this.feedbackCount = (this.feedbackCount ?? 0) + 1;
  }

  /** Saves the country choice (GDD v0.26 §9.1): a code or `NO_COUNTRY`. */
  setCountry(choice: string): void {
    this.country = choice;
  }

  /** The value a row shows on its right, or `undefined` for a row without one. */
  value(row: MessageKey): RowValue | undefined {
    if (row === 'country') return countryValue(this.country);
    if (row === 'music') return this.musicVolume;
    if (row === 'soundEffects') return this.sfxVolume;
    if (row === 'autofire') return onOff(this.autofire);
    if (row === 'fullscreen') return onOff(this.fullscreen);
    if (row === 'language') return this.language === 'en' ? 'english' : 'francais';
    return isEffectRow(row) ? onOff(this.effects[row]) : undefined;
  }

  /** Applies the row's change: flips a switch, the language, or sets every effect; true if any. */
  apply(row: MessageKey): boolean {
    if (row === 'autofire') this.autofire = !this.autofire;
    else if (row === 'music') this.musicVolume = cycleVolume(this.musicVolume);
    else if (row === 'soundEffects') this.sfxVolume = cycleVolume(this.sfxVolume);
    else if (row === 'fullscreen') this.fullscreen = !this.fullscreen;
    else if (row === 'language') this.language = this.language === 'en' ? 'fr' : 'en';
    else if (row === 'allOn' || row === 'allOff') this.setAllEffects(row === 'allOn');
    else if (isEffectRow(row)) this.effects[row] = !this.effects[row];
    else return false;
    return true;
  }

  /** Left (−1) or right (1) on a volume row: one step, held at 0 and 10 (GDD v0.23 §9.3). */
  nudge(row: VolumeRow, direction: number): void {
    if (row === 'music') this.musicVolume = nudgeVolume(this.musicVolume, direction);
    else this.sfxVolume = nudgeVolume(this.sfxVolume, direction);
  }

  private setAllEffects(on: boolean): void {
    for (let i = 0; i < EFFECT_ROWS.length; i += 1) {
      const key = EFFECT_ROWS[i];
      if (key !== undefined) this.effects[key] = on;
    }
  }
}
