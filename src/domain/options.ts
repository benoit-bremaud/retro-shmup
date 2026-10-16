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
}

/** The player's options (GDD v0.13 §9.3, v0.15 §4.2); the volumes (G3) come later. */
export interface Options {
  readonly effects: Readonly<EffectSettings>;
  /** Touch and mouse fire all the time (ADR-0020 decision 4). */
  readonly autofire: boolean;
  readonly language: Language;
  readonly fullscreen: boolean;
  /** Both devices' slots (ADR-0012), replaced whole by each rebinding. */
  readonly bindings: Bindings;
}

/** The effect switches, in screen order; each row's message key is its `EffectSettings` key. */
export const EFFECT_ROWS = [
  'blink',
  'hitFlash',
  'explosions',
  'shake',
  'bombFlash',
  'slowMotion',
  'championName',
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

  /** A copy of the saved options. */
  constructor(saved: Readonly<Options>) {
    this.effects = { ...saved.effects };
    this.autofire = saved.autofire;
    this.language = saved.language;
    this.fullscreen = saved.fullscreen;
    this.bindings = saved.bindings;
  }

  /** The value a row shows on its right, or `undefined` for a row without one. */
  value(row: MessageKey): MessageKey | undefined {
    if (row === 'autofire') return onOff(this.autofire);
    if (row === 'fullscreen') return onOff(this.fullscreen);
    if (row === 'language') return this.language === 'en' ? 'english' : 'francais';
    return isEffectRow(row) ? onOff(this.effects[row]) : undefined;
  }

  /** Applies the row's change: flips a switch, the language, or sets every effect; true if any. */
  apply(row: MessageKey): boolean {
    if (row === 'autofire') this.autofire = !this.autofire;
    else if (row === 'fullscreen') this.fullscreen = !this.fullscreen;
    else if (row === 'language') this.language = this.language === 'en' ? 'fr' : 'en';
    else if (row === 'allOn' || row === 'allOff') this.setAllEffects(row === 'allOn');
    else if (isEffectRow(row)) this.effects[row] = !this.effects[row];
    else return false;
    return true;
  }

  private setAllEffects(on: boolean): void {
    for (let i = 0; i < EFFECT_ROWS.length; i += 1) {
      const key = EFFECT_ROWS[i];
      if (key !== undefined) this.effects[key] = on;
    }
  }
}
