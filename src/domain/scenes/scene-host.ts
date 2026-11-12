import type { HighScoreEntry } from '../hall-of-fame/high-scores';
import type { BindableDevice } from '../input/bindings-editor';
import type { Options } from '../options';
import type { BindingCapture } from '../ports/input-port';

/**
 * What the scene machine tells the outside and asks of it (meta/04-class-menus): the composition
 * root saves the options and forwards autofire, fullscreen, the movement release and the binding
 * capture to the input port, so the domain never sees storage or the browser.
 */
export interface SceneHost {
  /** After each change of an option: the live options, to read at once and never keep. */
  optionsChanged(options: Readonly<Options>): void;
  /** On each exit from a menu towards play: a mouse or touch owner lets the ship go (§9.1). */
  releaseMovement(): void;
  /** The binding capture of the controls screen (GDD v0.15 §4.2, SD-remap): `InputPort`'s. */
  startCapture(device: BindableDevice): void;
  captureNext(): BindingCapture;
  cancelCapture(): void;
  /** `InputPort.label`: a letter or digit key's printed character, else `''`. */
  keyLabel(code: string): string;
  /**
   * What the browser hints about the player's country, for the choice's suggestions (GDD v0.34
   * §9.1): the time zone's country, then the region of its first language (ADR-0021 decision 4
   * and its 2026-10-26 amendment); the domain checks each is known.
   */
  countryHints(): readonly string[];
  /** Today's date as `YYYY-MM-DD`: the domain reads no clock (ADR-0006). */
  today(): string;
  /** After a new entry: the whole table, to save with the options (SD-score). */
  highScoresChanged(entries: readonly HighScoreEntry[]): void;
}

const CANCELLED: BindingCapture = { kind: 'cancelled' };
const NO_HINTS: readonly string[] = [];

/** A host that saves nothing and captures nothing: the tests' default. */
export const NO_HOST: SceneHost = {
  optionsChanged: () => undefined,
  releaseMovement: () => undefined,
  startCapture: () => undefined,
  captureNext: () => CANCELLED,
  cancelCapture: () => undefined,
  keyLabel: () => '',
  countryHints: () => NO_HINTS,
  today: () => '2026-01-01',
  highScoresChanged: () => undefined,
};
