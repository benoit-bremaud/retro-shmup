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
}

const CANCELLED: BindingCapture = { kind: 'cancelled' };

/** A host that saves nothing and captures nothing: the tests' default. */
export const NO_HOST: SceneHost = {
  optionsChanged: () => undefined,
  releaseMovement: () => undefined,
  startCapture: () => undefined,
  captureNext: () => CANCELLED,
  cancelCapture: () => undefined,
  keyLabel: () => '',
};
