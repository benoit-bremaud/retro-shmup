import type { Language } from './i18n/messages';

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
}

/** The player's options (GDD v0.13 §9.3); the remap (G1b) and the volumes (G3) come later. */
export interface Options {
  readonly effects: Readonly<EffectSettings>;
  /** Touch and mouse fire all the time (ADR-0020 decision 4). */
  readonly autofire: boolean;
  readonly language: Language;
  readonly fullscreen: boolean;
}
