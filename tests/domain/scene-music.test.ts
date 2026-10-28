import { describe, expect, it } from 'vitest';
import { Track } from '../../src/domain/audio/music';
import { Sfx } from '../../src/domain/audio/sfx';
import { volumeGain } from '../../src/domain/audio/volume';
import { NoAttack } from '../../src/domain/game/attacks';
import type { BossDefinition } from '../../src/domain/game/boss';
import { DIVER } from '../../src/domain/game/enemy';
import { swayMovement } from '../../src/domain/game/movements';
import { Run, RunOutcome } from '../../src/domain/game/run';
import type { LevelScript } from '../../src/domain/game/level-script';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import type { Options } from '../../src/domain/options';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { Starfield } from '../../src/domain/presentation/starfield';
import { NO_HOST } from '../../src/domain/scenes/scene-host';
import type { SceneHost } from '../../src/domain/scenes/scene-host';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';
import { RecordingAudio } from '../support/recording-audio';
import { RecordingRender } from '../support/recording-render';
import { STUB_BOSS, testScript } from '../support/script';

const DT = 1 / 60;

const OPTIONS: Options = {
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
};

/** A boss that one shot kills, on the ship's line: the run is cleared in a few seconds. */
const GLASS: BossDefinition = {
  ...STUB_BOSS,
  stats: { ...STUB_BOSS.stats, hp: 10 },
  phases: [
    { hpThreshold: 10, movement: swayMovement({ amplitude: 0, periodS: 8 }), attack: NoAttack },
  ],
  warningS: 1,
  entryS: 1,
};

/** Three Divers straight down on an idle ship: three deaths, then Game over. */
const KILLER: LevelScript = testScript(
  [2, 6.5, 11].map((at) => ({ at, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } })),
);

interface Fixture {
  machine: SceneMachine;
  audio: RecordingAudio;
  render: RecordingRender;
  saved: Options[];
}

type InRun = ConstructorParameters<typeof SceneMachine>[3];

const CLEARED: InRun = () => new Run({ levels: [testScript([], { warningAt: 5, boss: GLASS })] });

/** A run already over, worth `score` points: the name entry follows its Game over. */
function losing(score: number): InRun {
  return () => {
    const real = new Run();
    return {
      step: (): void => undefined,
      outcome: (): RunOutcome => RunOutcome.GameOver,
      snapshot: () => ({ ...real.snapshot(), score }),
      events: () => real.events(),
      tally: () => real.tally(),
    };
  };
}

function onTitle(createRun: InRun = CLEARED): Fixture {
  const audio = new RecordingAudio();
  const render = new RecordingRender();
  const saved: Options[] = [];
  const host: SceneHost = {
    ...NO_HOST,
    optionsChanged: (options) => {
      saved.push({ ...options });
    },
  };
  const machine = new SceneMachine(
    render,
    new Starfield(() => 0.5),
    OPTIONS,
    createRun,
    host,
    undefined,
    { audio },
  );
  machine.step(DT, createIntentFrame());
  return { machine, audio, render, saved };
}

function pressed(buttons: number): IntentFrame {
  const frame = createIntentFrame();
  frame.pressed = buttons;
  return frame;
}

function moved(x: number, y: number): IntentFrame {
  const frame = createIntentFrame();
  frame.moveKind = 'direction';
  frame.moveX = x;
  frame.moveY = y;
  return frame;
}

/** One press of a direction, released after. */
function tilt(machine: SceneMachine, x: number, y: number): void {
  machine.step(DT, moved(x, y));
  machine.step(DT, createIntentFrame());
}

function idle(machine: SceneMachine, steps: number): void {
  for (let i = 0; i < steps; i += 1) machine.step(DT, createIntentFrame());
}

function toAudio(machine: SceneMachine): void {
  tilt(machine, 0, 1);
  tilt(machine, 0, 1);
  machine.step(DT, pressed(Button.Confirm)); // Options
  tilt(machine, 0, 1);
  machine.step(DT, pressed(Button.Confirm)); // Audio
}

function fieldTexts(render: RecordingRender): string[] {
  return render.texts.filter((text) => text.region === 'field').map((text) => text.text);
}

describe('SceneMachine — the Audio sub-screen (GDD v0.23 §9.3)', () => {
  it('sets the saved volumes at start, and lists both with their steps', () => {
    const { machine, audio, render } = onTitle();
    expect(audio.volumes).toEqual([volumeGain(7), volumeGain(8)]);
    toAudio(machine);
    expect(machine.scene).toBe(Scene.TitleAudio);
    machine.render(0, 16);
    expect(fieldTexts(render)).toEqual(['AUDIO', 'MUSIC', '7', 'SOUND EFFECTS', '8', 'BACK']);
  });

  it('nudges a volume by one on left and right, held at 10, and saves each change', () => {
    const { machine, audio, saved } = onTitle();
    toAudio(machine);
    for (let i = 0; i < 4; i += 1) tilt(machine, 1, 0);
    expect(saved.map((options) => options.musicVolume)).toEqual([8, 9, 10, 10]);
    tilt(machine, -1, 0);
    expect(saved.at(-1)?.musicVolume).toBe(9);
    expect(audio.volumes).toEqual([volumeGain(9), volumeGain(8)]);
  });

  it('adds one on an activation and wraps from 10 to 0', () => {
    const { machine, saved } = onTitle();
    toAudio(machine);
    tilt(machine, 0, 1); // Sound effects
    for (let i = 0; i < 3; i += 1) {
      machine.step(DT, pressed(Button.Confirm));
      machine.step(DT, createIntentFrame());
    }
    expect(saved.map((options) => options.sfxVolume)).toEqual([9, 10, 0]);
  });

  it('returns to the options on Back and on the Back row', () => {
    const { machine } = onTitle();
    toAudio(machine);
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.TitleOptions);
    tilt(machine, 0, 1);
    machine.step(DT, pressed(Button.Confirm)); // Audio again
    expect(machine.scene).toBe(Scene.TitleAudio);
    tilt(machine, 0, 1);
    tilt(machine, 0, 1);
    machine.step(DT, pressed(Button.Confirm)); // Back row
    expect(machine.scene).toBe(Scene.TitleOptions);
  });

  it('keeps the pause mix on in the pause Audio sub-screen', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, pressed(Button.Confirm)); // Play
    machine.step(DT, pressed(Button.Pause));
    tilt(machine, 0, 1);
    machine.step(DT, pressed(Button.Confirm)); // Options
    tilt(machine, 0, 1);
    machine.step(DT, pressed(Button.Confirm)); // Audio
    expect(machine.scene).toBe(Scene.PauseAudio);
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.PauseOptions);
    expect(audio.paused).toEqual([true]);
  });
});

describe('SceneMachine — music by scene (GDD v0.23 §6, §9.5)', () => {
  it('plays the title track on the title and level 1 in play', () => {
    const { machine, audio } = onTitle();
    expect(audio.tracks.at(-1)).toBe(Track.Title);
    machine.step(DT, pressed(Button.Confirm));
    expect(audio.tracks.at(-1)).toBe(Track.Level1);
  });

  it('falls silent through the warning, then plays the boss and the Results jingle', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 3000 && machine.scene === Scene.Playing; i += 1) machine.step(DT, fire);
    expect(machine.scene).toBe(Scene.Results);
    const changes = audio.tracks.filter((track, i) => i === 0 || track !== audio.tracks[i - 1]);
    expect(changes).toEqual([Track.Title, Track.Level1, null, Track.Boss, Track.Results]);
  });

  it('ticks once per tally line after the first on the Results', () => {
    const { machine, audio } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 3000 && machine.scene === Scene.Playing; i += 1) machine.step(DT, fire);
    const before = audio.played.length;
    idle(machine, 200);
    const ticks = audio.played.slice(before).filter((sfx) => sfx === Sfx.TallyTick);
    expect(ticks).toHaveLength(4);
  });

  it('plays the Game over jingle, then the title track', () => {
    const { machine, audio } = onTitle(() => new Run({ levels: [KILLER] }));
    machine.step(DT, pressed(Button.Confirm));
    for (let i = 0; i < 3000 && machine.scene === Scene.Playing; i += 1) {
      machine.step(DT, createIntentFrame());
    }
    expect(machine.scene).toBe(Scene.GameOver);
    expect(audio.tracks.at(-1)).toBe(Track.GameOver);
    for (let i = 0; i < 3000 && machine.scene === Scene.GameOver; i += 1) {
      machine.step(DT, createIntentFrame());
    }
    expect(machine.scene).toBe(Scene.Title);
    expect(audio.tracks.at(-1)).toBe(Track.Title);
  });
});

describe('SceneMachine — the controls and name-entry sounds (GDD v0.23 §9.5)', () => {
  it('plays the move and confirm sounds on the controls screen', () => {
    const { machine, audio } = onTitle();
    tilt(machine, 0, 1);
    tilt(machine, 0, 1);
    machine.step(DT, pressed(Button.Confirm)); // Options
    tilt(machine, 0, 1);
    tilt(machine, 0, 1);
    machine.step(DT, pressed(Button.Confirm)); // Controls
    expect(machine.scene).toBe(Scene.TitleControls);
    idle(machine, 20);
    const before = audio.played.length;
    tilt(machine, 0, 1);
    machine.step(DT, pressed(Button.Confirm)); // a capture starts
    expect(audio.played.slice(before)).toEqual([Sfx.MenuMove, Sfx.MenuConfirm]);
  });

  it('plays the move and confirm sounds on the name entry', () => {
    const { machine, audio } = onTitle(losing(500));
    machine.step(DT, pressed(Button.Confirm)); // Play
    machine.step(DT, createIntentFrame()); // Game over
    for (let i = 0; i < 61; i += 1) machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.NameEntry);
    expect(audio.tracks.at(-1)).toBe(Track.Title);
    idle(machine, 20);
    const before = audio.played.length;
    tilt(machine, 1, 0);
    machine.step(DT, pressed(Button.Confirm)); // a letter
    expect(audio.played.slice(before)).toEqual([Sfx.MenuMove, Sfx.MenuConfirm]);
  });
});
