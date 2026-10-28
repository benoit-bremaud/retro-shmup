import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import { LiveOptions } from '../../src/domain/options';
import type { Options } from '../../src/domain/options';
import { Button, REMAPPABLE_INTENTS, createIntentFrame } from '../../src/domain/ports/input-port';
import type { BindingCapture, IntentFrame } from '../../src/domain/ports/input-port';
import { ControlsScreen } from '../../src/domain/scenes/controls-screen';
import { NO_HOST } from '../../src/domain/scenes/scene-host';
import type { SceneHost } from '../../src/domain/scenes/scene-host';

/** A host whose capture answers what the test queues; it records starts, cancels and saves. */
class CaptureHost implements SceneHost {
  readonly answers: BindingCapture[] = [];
  readonly started: string[] = [];
  readonly saved: Options[] = [];
  cancelled = 0;
  releaseMovement(): void {
    // Not used by the controls screen.
  }
  preselectedCountry(): undefined {
    return undefined; // Not used by the controls screen, nor are today and highScoresChanged.
  }
  today(): string {
    return NO_HOST.today();
  }
  highScoresChanged(): void {
    // Not used by the controls screen.
  }
  optionsChanged(options: Readonly<Options>): void {
    this.saved.push(structuredClone({ ...options }));
  }
  startCapture(device: 'keyboard' | 'gamepad'): void {
    this.started.push(device);
  }
  captureNext(): BindingCapture {
    return this.answers.shift() ?? { kind: 'waiting' };
  }
  cancelCapture(): void {
    this.cancelled += 1;
    this.answers.unshift({ kind: 'cancelled' });
  }
  keyLabel(code: string): string {
    return (
      { KeyW: 'Z', KeyA: 'Q', KeyS: 'S', KeyD: 'D', KeyZ: 'W', KeyX: 'X', KeyP: 'P', KeyC: 'C' }[
        code
      ] ?? ''
    );
  }
}

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

function screen(device: IntentFrame['device'] = 'keyboard'): {
  controls: ControlsScreen;
  host: CaptureHost;
  options: LiveOptions;
} {
  const host = new CaptureHost();
  const options = new LiveOptions({
    effects: {
      blink: true,
      hitFlash: true,
      explosions: true,
      shake: true,
      bombFlash: true,
      slowMotion: true,
      championName: true,
      graze: true,
      chainHints: true,
    },
    autofire: false,
    language: 'fr',
    fullscreen: false,
    bindings: DEFAULT_BINDINGS,
    musicVolume: 7,
    sfxVolume: 8,
  });
  const controls = new ControlsScreen(options, host);
  controls.open(0, frame({ device }));
  return { controls, host, options };
}

const CONFIRM = (): IntentFrame => frame({ pressed: Button.Confirm });

describe('ControlsScreen — names and cells (GDD v0.15 §4.2)', () => {
  it('names each slot in the language and the layout', () => {
    const { controls } = screen();
    expect(controls.cell(0, 0)).toBe('↑');
    expect(controls.cell(0, 1)).toBe('Z'); // KeyW prints Z on AZERTY
    expect(controls.cell(4, 0)).toBe('ESPACE');
    expect(controls.cell(5, 1)).toBe('MAJ G');
    expect(controls.cell(6, 1)).toBe(''); // pause has no secondary
  });

  it('names the gamepad buttons when the gamepad was used last', () => {
    const { controls } = screen('gamepad');
    expect(controls.device).toBe('gamepad');
    expect([controls.cell(4, 0), controls.cell(5, 0), controls.cell(6, 0)]).toEqual([
      'A',
      'B',
      'START',
    ]);
  });

  it('follows the last keyboard or gamepad input while choosing a cell', () => {
    const { controls } = screen();
    controls.step(frame({ device: 'gamepad' }), 1);
    expect(controls.device).toBe('gamepad');
    controls.step(frame({ device: 'mouse' }), 2);
    expect(controls.device).toBe('gamepad');
  });
});

describe('ControlsScreen — the capture (GDD v0.15 §4.2, SD-remap)', () => {
  it('captures a key into the highlighted slot, saves, and shows the new name', () => {
    const { controls, host, options } = screen();
    controls.step(CONFIRM(), 1);
    expect(host.started).toEqual(['keyboard']);
    expect(controls.capturing).toBe(true);
    expect(controls.cell(0, 0)).toBe('APPUIE');
    host.answers.push({ kind: 'key', code: 'KeyC' });
    expect(controls.step(frame(), 2)).toBeUndefined();
    expect(controls.capturing).toBe(false);
    expect(options.bindings.keyboard.moveUp.primary).toBe('KeyC');
    expect(host.saved.at(-1)?.bindings.keyboard.moveUp.primary).toBe('KeyC');
    expect(controls.cell(0, 0)).toBe('C');
  });

  it('reads no menu action while waiting nor in the answering step', () => {
    const { controls, host } = screen();
    controls.step(CONFIRM(), 1);
    expect(controls.step(frame({ pressed: Button.Back | Button.Pause }), 2)).toBeUndefined();
    host.answers.push({ kind: 'cancelled' });
    expect(controls.step(frame({ pressed: Button.Back | Button.Confirm }), 3)).toBeUndefined();
    expect(host.started).toEqual(['keyboard']);
  });

  it('keeps waiting when the exchange is refused', () => {
    const { controls, host, options } = screen('gamepad');
    // Bomb's empty secondary takes A, fire's only button: refused, the wait goes on.
    for (let i = 0; i < 5; i += 1) {
      controls.step(frame({ device: 'gamepad', moveKind: 'direction', moveY: 1 }), 2 * i + 1);
      controls.step(frame({ device: 'gamepad' }), 2 * i + 2);
    }
    controls.step(frame({ device: 'gamepad', moveKind: 'direction', moveX: 1 }), 20);
    controls.step(frame({ device: 'gamepad', pressed: Button.Confirm }), 21);
    host.answers.push({ kind: 'button', index: 0 });
    controls.step(frame({ device: 'gamepad' }), 22);
    expect(controls.capturing).toBe(true);
    expect(host.started).toEqual(['gamepad', 'gamepad']);
    expect(options.bindings).toBe(DEFAULT_BINDINGS);
  });

  it('cancels on a tap, the slot unchanged', () => {
    const { controls, host, options } = screen();
    controls.step(CONFIRM(), 1);
    controls.step(frame({ tapRegion: 'field', tapX: 10, tapY: 10 }), 2);
    expect(host.cancelled).toBe(1);
    expect(controls.capturing).toBe(false);
    expect(options.bindings).toBe(DEFAULT_BINDINGS);
  });

  it('keeps the edited device fixed during a capture', () => {
    const { controls } = screen();
    controls.step(CONFIRM(), 1);
    controls.step(frame({ device: 'gamepad' }), 2);
    expect(controls.device).toBe('keyboard');
  });
});

describe('ControlsScreen — Back and Restore defaults', () => {
  it('answers back on the Back row and on the back intent', () => {
    const { controls } = screen();
    expect(controls.step(frame({ pressed: Button.Back }), 1)).toBe('back');
  });

  it('restores the edited device only', () => {
    const { controls, host, options } = screen();
    options.bindings = {
      keyboard: { ...DEFAULT_BINDINGS.keyboard, pause: { primary: 'KeyP', secondary: 'KeyC' } },
      gamepad: { ...DEFAULT_BINDINGS.gamepad, fire: { primary: 0, secondary: 2 } },
    };
    controls.restoreDefaults();
    expect(options.bindings.keyboard).toEqual(DEFAULT_BINDINGS.keyboard);
    expect(options.bindings.gamepad.fire.secondary).toBe(2);
    expect(host.saved).toHaveLength(1);
  });

  it('names the edited device for the screen header', () => {
    expect(screen('keyboard').controls.deviceName).toBe('keyboard');
    expect(screen('gamepad').controls.deviceName).toBe('gamepad');
  });

  it('shows no text for a row that is not an intent', () => {
    const { controls } = screen();
    expect(controls.cell(controls.intentRows, 0)).toBe('');
  });

  it('shows a blank for a gamepad slot without a button', () => {
    const { controls } = screen('gamepad');
    // Fire has no secondary button by default.
    expect(controls.cell(REMAPPABLE_INTENTS.indexOf('fire'), 1)).toBe('');
  });
});
