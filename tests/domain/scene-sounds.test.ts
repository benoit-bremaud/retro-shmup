import { describe, expect, it } from 'vitest';
import { Sfx } from '../../src/domain/audio/sfx';
import { Run } from '../../src/domain/game/run';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { Starfield } from '../../src/domain/presentation/starfield';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';
import { RecordingAudio } from '../support/recording-audio';
import { RecordingRender } from '../support/recording-render';

const DT = 1 / 60;

function onTitle(): { machine: SceneMachine; audio: RecordingAudio } {
  const audio = new RecordingAudio();
  const machine = new SceneMachine(
    new RecordingRender(),
    new Starfield(() => 0.5),
    {
      effects: {
        blink: true,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
        championName: true,
        graze: true,
      },
      autofire: false,
      language: 'en',
      fullscreen: false,
      bindings: DEFAULT_BINDINGS,
      musicVolume: 7,
      sfxVolume: 8,
      country: 'FR',
    },
    () => new Run(),
    undefined,
    undefined,
    { audio },
  );
  machine.step(DT, createIntentFrame());
  return { machine, audio };
}

function pressed(buttons: number): IntentFrame {
  const frame = createIntentFrame();
  frame.pressed = buttons;
  return frame;
}

function down(): IntentFrame {
  const frame = createIntentFrame();
  frame.moveKind = 'direction';
  frame.moveY = 1;
  return frame;
}

describe('SceneMachine — menu sounds and the pause mix (GDD v0.23 §9.5, ADR-0009)', () => {
  it('plays the move sound on a new highlight and the confirm sound on an activation', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, down());
    machine.step(DT, down());
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    expect(audio.played).toEqual([Sfx.MenuMove, Sfx.MenuConfirm]);
  });

  it('turns the pause mix on in the pause and off from the count-in', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Playing);
    machine.step(DT, pressed(Button.Pause));
    expect(machine.scene).toBe(Scene.Paused);
    for (let i = 0; i < 10; i += 1) machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.CountIn);
    expect(audio.paused).toEqual([true, false]);
  });

  it('passes its audio to the run, whose shots sound', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 60; i += 1) {
      machine.step(DT, fire);
      machine.render(1, DT * 1000);
    }
    expect(audio.played).toContain(Sfx.ShotSpread);
  });

  it('turns the pause mix off when Confirm quit leaves to the title', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, pressed(Button.Pause));
    machine.step(DT, down());
    machine.step(DT, createIntentFrame());
    machine.step(DT, down());
    machine.step(DT, pressed(Button.Confirm)); // Quit
    machine.step(DT, down());
    machine.step(DT, pressed(Button.Confirm)); // Yes
    expect(machine.scene).toBe(Scene.Title);
    expect(audio.paused).toEqual([true, false]);
  });

  it('keeps the pause mix on, without repeated calls, through the pause options', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, pressed(Button.Pause));
    machine.step(DT, down());
    machine.step(DT, pressed(Button.Confirm)); // Options
    expect(machine.scene).toBe(Scene.PauseOptions);
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.Paused);
    expect(audio.paused).toEqual([true]);
  });
});
