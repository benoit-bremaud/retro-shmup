import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import type { EffectSettings, Options } from '../../src/domain/options';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { BindingCapture, IntentFrame } from '../../src/domain/ports/input-port';
import { Palette } from '../../src/domain/presentation/palette';
import { Starfield } from '../../src/domain/presentation/starfield';
import { DIVER, POPCORN } from '../../src/domain/game/enemy';
import type { LevelScript } from '../../src/domain/game/level-script';
import { NoAttack } from '../../src/domain/game/attacks';
import { BossState } from '../../src/domain/game/boss';
import type { BossDefinition } from '../../src/domain/game/boss';
import { swayMovement } from '../../src/domain/game/movements';
import { Run, RunOutcome } from '../../src/domain/game/run';
import {
  MENU_HEADER_GAP,
  MENU_ROW_HEIGHT,
  menuRowHeight,
  menuTop,
} from '../../src/domain/presentation/menu-layout';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';
import type { HighScoreEntry } from '../../src/domain/hall-of-fame/high-scores';
import { NO_HOST } from '../../src/domain/scenes/scene-host';
import type { SceneHost } from '../../src/domain/scenes/scene-host';
import type { ArmedLink, LinkOutcome, LinkPort } from '../../src/domain/ports/link-port';
import { PORTRAIT } from '../../src/domain/presentation/screen';
import { RecordingRender } from '../support/recording-render';
import type { RecordedRect } from '../support/recording-render';
import { STUB_BOSS, testScript } from '../support/script';

const DT = 1 / 60;

/** Ten scores no test run reaches: a finished run goes straight to the title. */
const FULL_TABLE: readonly HighScoreEntry[] = Array.from({ length: 10 }, () => ({
  name: 'ACE',
  score: 99_000_000,
  level: 1,
  date: '2026-10-15',
}));

/** The options a test needs: these effect switches, the rest at its defaults. */
function withEffects(effects: EffectSettings): Options {
  return {
    effects,
    autofire: false,
    language: 'en',
    fullscreen: false,
    bindings: DEFAULT_BINDINGS,
    musicVolume: 7,
    sfxVolume: 8,
    country: 'FR',
  };
}

function setup(): { machine: SceneMachine; render: RecordingRender } {
  const render = new RecordingRender();
  const machine = new SceneMachine(
    render,
    new Starfield(() => 0.5),
    withEffects({
      blink: true,
      hitFlash: true,
      explosions: true,
      shake: true,
      bombFlash: true,
      slowMotion: true,
      championName: true,
      graze: true,
      chainHints: true,
    }),
    () => new Run(),
  );
  return { machine, render };
}

function pressed(buttons: number): IntentFrame {
  const frame = createIntentFrame();
  frame.pressed = buttons;
  return frame;
}

function tapped(): IntentFrame {
  const frame = createIntentFrame();
  frame.tapRegion = 'field';
  frame.tapX = 10;
  frame.tapY = 10;
  return frame;
}

/** Boot loads nothing yet: the first step reaches the title. */
function onTitle(): ReturnType<typeof setup> {
  const fixture = setup();
  fixture.machine.step(DT, createIntentFrame());
  return fixture;
}

describe('SceneMachine — first-playable subset (meta/05-state-scenes)', () => {
  it('keeps a press latched before the first step: Boot hands its frame to the title', () => {
    const { machine } = setup();
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('starts in Boot and reaches the title on its first step', () => {
    const { machine } = setup();
    expect(machine.scene).toBe(Scene.Boot);
    machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Title);
  });

  it('starts a run from the title on Confirm, Play being highlighted first', () => {
    const { machine } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('starts a run from a tap on the Play row, and not from a stray tap (GDD v0.14)', () => {
    const { machine } = onTitle();
    for (let i = 0; i < 10; i += 1) machine.step(DT, createIntentFrame());
    machine.step(DT, tapped());
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, rowTap(0, 3));
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('ignores Pause and Back on the title', () => {
    const { machine } = onTitle();
    machine.step(DT, pressed(Button.Pause | Button.Back | Button.Fire));
    expect(machine.scene).toBe(Scene.Title);
  });
});

describe('SceneMachine — presentation of the first playable', () => {
  it('draws the starfield and the empty HUD bands on the title, but no ship', () => {
    const { machine, render } = onTitle();
    machine.render(0, 16);
    expect(render.drew(Palette.starFar)).toBe(true);
    expect(render.drew(Palette.hudBand)).toBe(true);
    expect(render.drew(Palette.shipHull)).toBe(false);
    expect(render.presented).toBe(1);
  });

  it('draws the ship once the run has started', () => {
    const { machine, render } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    machine.render(0, 16);
    expect(render.drew(Palette.shipHull)).toBe(true);
  });

  it('steps the run in play: held fire draws bullets after the fly-in', () => {
    const { machine, render } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 31; i += 1) machine.step(DT, fire);
    machine.render(0, 16);
    expect(render.drew(Palette.playerShot)).toBe(true);
  });
});

describe('SceneMachine — frozen blink', () => {
  it('never advances the blink while the simulation does not step', () => {
    const { machine, render } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    for (let i = 0; i < 11; i += 1) machine.step(DT, createIntentFrame()); // hidden half
    for (const wallDtMs of [16, 250, 1000]) {
      machine.render(0.9, wallDtMs);
      expect(render.drew(Palette.shipHull)).toBe(false);
    }
  });
});

// Fly-in (0.5 s) then invulnerability (1.5 s): after these the ship is vulnerable and never blinks.
const UNTIL_VULNERABLE_STEPS = 30 + 90;

function frame(pressedButtons: number, moveX = 0): IntentFrame {
  const f = createIntentFrame();
  f.pressed = pressedButtons;
  if (moveX !== 0) {
    f.moveKind = 'direction';
    f.moveX = moveX;
  }
  return f;
}

/** A run in play with a vulnerable ship: it answers to movement and is always drawn. */
function playing(): ReturnType<typeof setup> {
  const fixture = onTitle();
  fixture.machine.step(DT, pressed(Button.Confirm));
  for (let i = 0; i < UNTIL_VULNERABLE_STEPS; i += 1) fixture.machine.step(DT, createIntentFrame());
  return fixture;
}

/** The hull rectangle drawn by the last frame: where the ship is on screen. */
function hull(fixture: ReturnType<typeof setup>, alpha: number): RecordedRect | undefined {
  fixture.machine.render(alpha, 16);
  return fixture.render.rectsOf(Palette.shipHull)[0];
}

describe('SceneMachine — Paused and Count-in (meta/05-state-scenes, pause rules)', () => {
  it('enters Paused on Pause in play, before the run steps', () => {
    const fixture = playing();
    const before = hull(fixture, 1);
    fixture.machine.step(DT, frame(Button.Pause, 1));
    expect(fixture.machine.scene).toBe(Scene.Paused);
    expect(hull(fixture, 1)).toEqual(before);
  });

  it('moves nothing while paused, the starfield included', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.render(1, 16);
    const frozen = [...fixture.render.rects];
    for (let i = 0; i < 100; i += 1) fixture.machine.step(DT, frame(0, 1));
    fixture.machine.render(1, 16);
    expect(fixture.render.rects).toEqual(frozen);
  });

  it('draws a frozen scene at alpha 1, whatever the loop alpha', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(0, 1)); // previous and current positions now differ
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.render(0.1, 16);
    const early = [...fixture.render.rects];
    fixture.machine.render(0.9, 250);
    expect(fixture.render.rects).toEqual(early);
  });

  it.each([
    ['Confirm', Button.Confirm],
    ['Back', Button.Back],
    ['Esc (Pause and Back)', Button.Pause | Button.Back],
  ])('starts the count-in on %s in Paused', (_label, buttons) => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, frame(buttons));
    expect(fixture.machine.scene).toBe(Scene.CountIn);
  });

  it('ignores Pause in Paused, so a lost focus never resumes', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, frame(Button.Pause));
    expect(fixture.machine.scene).toBe(Scene.Paused);
  });

  it('returns to Paused on Pause during the count-in', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, frame(Button.Confirm));
    fixture.machine.step(DT, frame(Button.Pause));
    expect(fixture.machine.scene).toBe(Scene.Paused);
  });

  it('lasts 1 s: its 60th step hands over to Playing and steps the run', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, frame(Button.Confirm)); // Paused -> Count-in
    const frozen = hull(fixture, 1);
    if (frozen === undefined) throw new Error('the ship is not drawn');
    for (let i = 0; i < 59; i += 1) fixture.machine.step(DT, frame(0, 1));
    expect(fixture.machine.scene).toBe(Scene.CountIn);
    expect(hull(fixture, 1)).toEqual(frozen);
    fixture.machine.step(DT, frame(0, 1));
    expect(fixture.machine.scene).toBe(Scene.Playing);
    const resumed = hull(fixture, 1);
    if (resumed === undefined) throw new Error('the ship is not drawn');
    expect(resumed.x).toBeGreaterThan(frozen.x);
  });

  it('interpolates the first resumed frame forward from the frozen picture', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(0, 1)); // previous and current positions now differ
    const moving = hull(fixture, 0);
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, frame(Button.Confirm));
    const frozen = hull(fixture, 0); // a frozen frame ignores the loop alpha: current position
    expect(frozen).not.toEqual(moving);
    for (let i = 0; i < 60; i += 1) fixture.machine.step(DT, frame(0, 1));
    expect(hull(fixture, 0)).toEqual(frozen);
  });

  it('draws the starfield of a frozen scene at alpha 1, so it never steps back at the pause', () => {
    const fixture = playing();
    fixture.machine.render(1, 16);
    const playingStars = fixture.render.rectsOf(Palette.starNear).map((star) => star.y);
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.render(0, 16);
    const pausedStars = fixture.render.rectsOf(Palette.starNear).map((star) => star.y);
    expect(pausedStars).toEqual(playingStars);
  });

  it('keeps the time scale at 1 in play while no slow motion runs', () => {
    expect(playing().machine.timeScale()).toBe(1);
  });

  it('draws the starfield and the HUD bands in Boot, before the first step', () => {
    const { machine, render } = setup();
    machine.render(0, 16);
    expect(render.drew(Palette.starFar)).toBe(true);
    expect(render.drew(Palette.hudBand)).toBe(true);
    expect(render.presented).toBe(1);
  });

  it('keeps the time scale at 1 in Paused and Count-in', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    expect(fixture.machine.timeScale()).toBe(1);
    fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.timeScale()).toBe(1);
  });

  it('draws the veil and the pause menu in Paused, the digits in Count-in', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.render(1, 16);
    expect(fixture.render.drew(Palette.veil)).toBe(true);
    expect(fixture.render.drew(Palette.menuHighlight)).toBe(true);
    const fieldTexts = (): string[] =>
      fixture.render.texts.filter((text) => text.region === 'field').map((text) => text.text);
    expect(fieldTexts()).toEqual(['PAUSE', 'RESUME', 'OPTIONS', 'QUIT']);
    fixture.machine.step(DT, frame(Button.Confirm));
    fixture.machine.render(1, 16);
    expect(fieldTexts()).toEqual(['3']);
    expect(fixture.render.drew(Palette.menuHighlight)).toBe(false);
  });
});

/** Three Divers straight down on an idle ship at rest: three deaths, then Game over. */
const KILLER: LevelScript = testScript([
  ...[2, 6.5, 11].map((at) => ({
    at,
    archetype: DIVER,
    count: 1,
    spawn: { x: 120, y: -8 },
  })),
  // Far from the ship (x 0 to 80): still flying when the run ends, so Game over shows it move.
  { at: 14, archetype: POPCORN, count: 1, spawn: { x: 40, y: -8 } },
]);

function gameOverFixture(): ReturnType<typeof setup> {
  const render = new RecordingRender();
  const machine = new SceneMachine(
    render,
    new Starfield(() => 0.5),
    withEffects({
      blink: true,
      hitFlash: true,
      explosions: true,
      shake: true,
      bombFlash: true,
      slowMotion: true,
      championName: true,
      graze: true,
      chainHints: true,
    }),
    () => new Run({ levels: [KILLER] }),
  );
  machine.step(DT, createIntentFrame());
  machine.step(DT, pressed(Button.Confirm));
  for (let i = 0; i < 3000 && machine.scene === Scene.Playing; i += 1) {
    machine.step(DT, createIntentFrame());
  }
  return { machine, render };
}

describe('SceneMachine — Game over (GDD §4.4, meta/05-state-scenes)', () => {
  it('enters Game over when the run ends after its last death sequence', () => {
    expect(gameOverFixture().machine.scene).toBe(Scene.GameOver);
  });

  it('returns to the title after 3 s', () => {
    const { machine } = gameOverFixture();
    for (let i = 0; i < 179; i += 1) machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.GameOver);
    machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Title);
  });

  it.each([
    ['Confirm', pressed(Button.Confirm)],
    ['a tap', tapped()],
  ])('ignores %s for 1 s, then returns to the title on it', (_label, frame) => {
    const { machine } = gameOverFixture();
    for (let i = 0; i < 60; i += 1) machine.step(DT, frame);
    expect(machine.scene).toBe(Scene.GameOver);
    machine.step(DT, frame);
    expect(machine.scene).toBe(Scene.Title);
  });

  it('locks the title reached from Game over for 1 s, so hammering never starts a run', () => {
    const { machine } = gameOverFixture();
    for (let i = 0; i < 61; i += 1) machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Title);
    for (let i = 0; i < 60; i += 1) machine.step(DT, rowTap(0, 3));
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, rowTap(0, 3));
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('locks the title reached by the game-over time as well', () => {
    const { machine } = gameOverFixture();
    for (let i = 0; i < 180; i += 1) machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Title);
  });

  it('draws no pause button', () => {
    const { machine, render } = gameOverFixture();
    machine.render(0, 16);
    expect(render.drew(Palette.pauseButton)).toBe(false);
  });

  it('ignores Pause', () => {
    const { machine } = gameOverFixture();
    machine.step(DT, pressed(Button.Pause | Button.Back));
    expect(machine.scene).toBe(Scene.GameOver);
  });

  it('shows a large GAME OVER from the catalogue over a veil', () => {
    const { machine, render } = gameOverFixture();
    machine.render(0, 16);
    expect(render.drew(Palette.veil)).toBe(true);
    expect(render.texts.filter((text) => text.font === 'title')).toEqual([
      { region: 'field', x: 50, y: 150, text: 'GAME OVER', font: 'title' },
    ]);
  });

  it('keeps the run and the starfield moving behind it, arcade style', () => {
    const { machine, render } = gameOverFixture();
    machine.render(0, 16);
    const before = render.rectsOf(Palette.popcorn).map((rect) => rect.y);
    const starsBefore = render.rectsOf(Palette.starNear).map((rect) => rect.y);
    expect(before).toHaveLength(1);
    for (let i = 0; i < 30; i += 1) machine.step(DT, createIntentFrame());
    machine.render(0, 16);
    expect(render.rectsOf(Palette.popcorn).map((rect) => rect.y)[0]).toBeGreaterThan(
      before[0] ?? 0,
    );
    expect(render.rectsOf(Palette.starNear).map((rect) => rect.y)).not.toEqual(starsBefore);
  });
});

describe('SceneMachine — effects per run (ADR-0010, 02-sequence-fixed-step-tick)', () => {
  /** A run whose first Diver is shot at once: it explodes on screen. */
  const TARGET: LevelScript = testScript([
    { at: 0, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
  ]);

  function exploding(): ReturnType<typeof setup> {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects({
        blink: true,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
        championName: true,
        graze: true,
        chainHints: true,
      }),
      () => new Run({ levels: [TARGET] }),
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 200; i += 1) {
      machine.step(DT, fire);
      machine.render(1, 0);
      if (render.drew(Palette.explosionHot)) break;
    }
    return { machine, render };
  }

  it('freezes effects in a frame that ran a frozen step, the count-in handoff included', () => {
    const { machine, render } = exploding();
    machine.step(DT, pressed(Button.Pause));
    machine.step(DT, pressed(Button.Confirm));
    for (let i = 0; i < 60; i += 1) machine.step(DT, createIntentFrame()); // last one hands over
    machine.render(0, 250); // Playing now, but this frame ran frozen steps: it ages nothing
    expect(render.drew(Palette.explosionHot)).toBe(true);
    machine.render(0, 250); // still drawn at age 0 (hot), then aged to 250 ms
    expect(render.drew(Palette.explosionHot)).toBe(true);
    machine.render(0, 250); // 250 ms: cool, then 500 ms
    machine.render(0, 250);
    expect(render.drew(Palette.explosionHot) || render.drew(Palette.explosionCool)).toBe(false);
  });

  it('gives a new run a new presenter: no effect carries over from the previous run', () => {
    // A Diver shot at once (an explosion, never aged: no render), then three that kill the ship.
    const script: LevelScript = testScript(
      [0, 2, 6.5, 11].map((at) => ({
        at,
        archetype: DIVER,
        count: 1,
        spawn: { x: 120, y: -8 },
      })),
    );
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects({
        blink: true,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
        championName: true,
        graze: true,
        chainHints: true,
      }),
      () => new Run({ levels: [script] }),
      NO_HOST,
      FULL_TABLE,
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    // Shoots the first Diver (hit near step 64); the last shot leaves the field before 2 s.
    for (let i = 0; i < 70; i += 1) machine.step(DT, fire);
    machine.render(1, 0); // a zero frame time never ages it
    expect(render.drew(Palette.explosionHot)).toBe(true);
    for (let i = 0; i < 3000 && machine.scene === Scene.Playing; i += 1) {
      machine.step(DT, createIntentFrame());
    }
    expect(machine.scene).toBe(Scene.GameOver);
    for (let i = 0; i < 61; i += 1) machine.step(DT, pressed(Button.Confirm)); // to the title
    for (let i = 0; i < 61; i += 1) machine.step(DT, pressed(Button.Confirm)); // a new run
    expect(machine.scene).toBe(Scene.Playing);
    machine.render(1, 0);
    expect(render.drew(Palette.explosionHot)).toBe(false);
  });
});

describe('SceneMachine — portrait screen (devices brick additions)', () => {
  it('draws the portrait strip instead of the bands, and the field overlays as before', () => {
    const fixture = playing();
    fixture.render.screen = PORTRAIT;
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.render(1, 16);
    expect(fixture.render.rectsOf(Palette.hudBand)).toEqual([
      { region: 'hud', x: 0, y: 0, w: 240, h: 32, colour: Palette.hudBand },
    ]);
    expect(fixture.render.rectsOf(Palette.veil)[0]).toMatchObject({ region: 'field', x: 0, y: 0 });
  });
});

/** A tap in the HUD region at logical-screen coordinates. */
function hudTap(x: number, y: number): IntentFrame {
  const tap = createIntentFrame();
  tap.tapRegion = 'hud';
  tap.tapX = x;
  tap.tapY = y;
  return tap;
}

// Inside the landscape pause button (432..479, 0..47) and the portrait one (192..239, 0..31).
const PAUSE_TAP = hudTap(440, 10);
const OTHER_HUD_TAP = hudTap(20, 200);

describe('SceneMachine — taps and the pause button (devices brick additions)', () => {
  it('never locks the first title: Confirm starts a run at once', () => {
    const { machine } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('enters Paused on a pause-button tap in play, before the run steps', () => {
    const fixture = playing();
    const before = hull(fixture, 1);
    const tap = hudTap(440, 10);
    tap.moveKind = 'direction';
    tap.moveY = 1;
    fixture.machine.step(DT, tap);
    expect(fixture.machine.scene).toBe(Scene.Paused);
    expect(hull(fixture, 1)).toEqual(before);
  });

  it('hit-tests the button of the current screen', () => {
    const fixture = playing();
    fixture.render.screen = PORTRAIT;
    fixture.machine.step(DT, PAUSE_TAP); // x 440 is off the portrait screen
    expect(fixture.machine.scene).toBe(Scene.Playing);
    fixture.machine.step(DT, hudTap(200, 10));
    expect(fixture.machine.scene).toBe(Scene.Paused);
  });

  it('ignores other HUD taps and field taps in play', () => {
    const fixture = playing();
    fixture.machine.step(DT, OTHER_HUD_TAP);
    fixture.machine.step(DT, tapped());
    expect(fixture.machine.scene).toBe(Scene.Playing);
  });

  it('starts the count-in on a pause-button tap in Paused', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, PAUSE_TAP);
    expect(fixture.machine.scene).toBe(Scene.CountIn);
  });

  it.each([
    ['another HUD tap', OTHER_HUD_TAP],
    ['a field tap off the menu', tapped()],
  ])('stays in Paused on %s: the tap resume is gone (G1a)', (_label, tap) => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, tap);
    expect(fixture.machine.scene).toBe(Scene.Paused);
  });

  it('returns to Paused on a pause-button tap during the count-in, and ignores other taps', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, frame(Button.Confirm));
    fixture.machine.step(DT, OTHER_HUD_TAP);
    fixture.machine.step(DT, tapped());
    expect(fixture.machine.scene).toBe(Scene.CountIn);
    fixture.machine.step(DT, PAUSE_TAP);
    expect(fixture.machine.scene).toBe(Scene.Paused);
  });

  it('draws the pause button in play, in the pause and in the count-in, not on the title', () => {
    const { machine, render } = onTitle();
    machine.render(0, 16);
    expect(render.drew(Palette.pauseButton)).toBe(false);
    machine.step(DT, pressed(Button.Confirm));
    machine.render(0, 16);
    expect(render.drew(Palette.pauseButton)).toBe(true);
    machine.step(DT, pressed(Button.Pause));
    machine.render(0, 16);
    expect(render.drew(Palette.pauseButton)).toBe(true);
    machine.step(DT, pressed(Button.Confirm));
    machine.render(0, 16);
    expect(render.drew(Palette.pauseButton)).toBe(true);
  });
});

describe('SceneMachine — the bomb shake (ADR-0014, GDD v0.8 §9.4)', () => {
  it('shakes the field after a bomb in play, and never in a frozen frame', () => {
    const fixture = playing();
    fixture.machine.step(DT, pressed(Button.Bomb));
    fixture.machine.render(1, 16);
    expect(fixture.render.camera.x).not.toBe(0);
    fixture.machine.step(DT, pressed(Button.Pause));
    fixture.machine.render(1, 16);
    expect(fixture.render.camera).toEqual({ x: 0, y: 0 });
  });

  it('keeps the camera still on the title', () => {
    const { machine, render } = onTitle();
    render.setCameraOffset(3, 3);
    machine.render(0, 16);
    expect(render.camera).toEqual({ x: 0, y: 0 });
  });
});

describe('SceneMachine — Results (meta/05-state-scenes, GDD v0.10 §8, F-3)', () => {
  /** A boss that one shot kills, standing on the ship's line: the run is cleared in a few steps. */
  const GLASS: BossDefinition = {
    ...STUB_BOSS,
    stats: { ...STUB_BOSS.stats, hp: 10 },
    phases: [
      {
        hpThreshold: 10,
        movement: swayMovement({ amplitude: 0, periodS: 8 }),
        attack: NoAttack,
      },
    ],
    warningS: 1,
    entryS: 1,
  };

  function clearedFixture(
    host: SceneHost = NO_HOST,
    highScores: readonly HighScoreEntry[] = FULL_TABLE,
  ): ReturnType<typeof setup> {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects({
        blink: true,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
        championName: true,
        graze: true,
        chainHints: true,
      }),
      () => new Run({ levels: [testScript([], { warningAt: 5, boss: GLASS })] }),
      host,
      highScores,
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    for (let i = 0; i < 3000 && machine.scene === Scene.Playing; i += 1) machine.step(DT, fire);
    return { machine, render };
  }

  it('enters Results when the run is cleared, with no pause button', () => {
    const { machine, render } = clearedFixture();
    expect(machine.scene).toBe(Scene.Results);
    machine.render(0, 16);
    expect(render.drew(Palette.pauseButton)).toBe(false);
  });

  it('draws no HP bar or seconds once the boss sequence has ended', () => {
    const { machine, render } = clearedFixture();
    machine.render(0, 16);
    expect(render.drew(Palette.bossBarFrame)).toBe(false);
  });

  it('shows the LEVEL CLEAR header and the first tally line over a veil on entry', () => {
    const { machine, render } = clearedFixture();
    machine.render(0, 16);
    expect(render.drew(Palette.veil)).toBe(true);
    const field = render.texts.filter((text) => text.region === 'field');
    expect(field.map((text) => text.text)).toEqual(['LEVEL CLEAR', 'FORMATIONS', '0 × 500  0']);
  });

  it('adds one line every 30 steps and ends on the total, read from the run tally', () => {
    const { machine, render } = clearedFixture();
    for (let i = 0; i < 120; i += 1) machine.step(DT, createIntentFrame());
    machine.render(0, 16);
    const values = render.texts
      .filter((text) => text.region === 'field' && text.font === 'hud')
      .map((text) => text.text);
    // No formation, no bomb, no life lost, the two starting bombs left.
    expect(values).toEqual(['0 × 500  0', '5 000', '10 000', '2 × 1 000  2 000', '17 000']);
  });

  it('keeps the starfield moving over the frozen run', () => {
    const { machine, render } = clearedFixture();
    machine.render(0, 16);
    const stars = render.rectsOf(Palette.starNear).map((rect) => rect.y);
    for (let i = 0; i < 30; i += 1) machine.step(DT, createIntentFrame());
    machine.render(0, 16);
    expect(render.rectsOf(Palette.starNear).map((rect) => rect.y)).not.toEqual(stars);
  });

  it.each([
    ['Confirm', pressed(Button.Confirm)],
    ['a tap', tapped()],
  ])('ignores %s for 1 s (60 steps), then goes to the Ending card on it', (_label, frame) => {
    const { machine } = clearedFixture();
    for (let i = 0; i < 60; i += 1) machine.step(DT, frame);
    expect(machine.scene).toBe(Scene.Results);
    machine.step(DT, frame);
    expect(machine.scene).toBe(Scene.Ending);
  });

  it('goes to the Ending card on its own after 8 s (480 steps); Pause and Back are ignored', () => {
    const { machine } = clearedFixture();
    for (let i = 0; i < 479; i += 1) machine.step(DT, pressed(Button.Pause | Button.Back));
    expect(machine.scene).toBe(Scene.Results);
    machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Ending);
  });

  it('shows VICTORY and the final score on the Ending card (GDD v0.16 §9.1)', () => {
    const { machine, render } = clearedFixture();
    for (let i = 0; i < 480; i += 1) machine.step(DT, createIntentFrame());
    machine.render(1, 16);
    const texts = render.texts.filter((text) => text.region === 'field').map((text) => text.text);
    expect(texts.slice(0, 2)).toEqual(['VICTORY', 'SCORE']);
    expect(texts[2]).toMatch(/^\d+$/);
  });

  it('leaves the Ending card after its 1 s lock or 6 s, to a title locked for 1 s', () => {
    const { machine } = clearedFixture();
    for (let i = 0; i < 480; i += 1) machine.step(DT, createIntentFrame());
    for (let i = 0; i < 60; i += 1) machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Ending);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Title);
    for (let i = 0; i < 60; i += 1) machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('keeps the starfield moving on the Ending card', () => {
    const { machine, render } = clearedFixture();
    for (let i = 0; i < 480; i += 1) machine.step(DT, createIntentFrame());
    machine.render(1, 16);
    const stars = render.rectsOf(Palette.starNear).map((rect) => rect.y);
    for (let i = 0; i < 30; i += 1) machine.step(DT, createIntentFrame());
    machine.render(1, 16);
    expect(render.rectsOf(Palette.starNear).map((rect) => rect.y)).not.toEqual(stars);
  });

  it('leaves the Ending card on its own after 6 s (360 steps)', () => {
    const { machine } = clearedFixture();
    for (let i = 0; i < 480; i += 1) machine.step(DT, createIntentFrame());
    for (let i = 0; i < 359; i += 1) machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Ending);
    machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Title);
  });
});

describe('SceneMachine — the boss HUD (meta/05-state-scenes, F-2b)', () => {
  /** Steps from the start of a run that land in the first, visible half-blink of the warning. */
  const IN_FIRST_BLINK = 310;

  /** A run whose boss warns at 5 s (the director's minimum is above 4 s): the WARNING lasts about
   * 180 steps from step 300, then the entry about 180 more. */
  function warningFixture(blink = true): ReturnType<typeof setup> {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects({
        blink,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
        championName: true,
        graze: true,
        chainHints: true,
      }),
      () => new Run({ levels: [testScript([], { warningAt: 5, boss: STUB_BOSS })] }),
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    return { machine, render };
  }

  function advance(fixture: ReturnType<typeof setup>, steps: number): void {
    for (let i = 0; i < steps; i += 1) fixture.machine.step(DT, createIntentFrame());
  }

  function titleTexts(render: RecordingRender): string[] {
    return render.texts.filter((text) => text.font === 'title').map((text) => text.text);
  }

  it('shows WARNING during the warning, blinking, and no HP bar yet', () => {
    const fixture = warningFixture();
    advance(fixture, IN_FIRST_BLINK); // 10 steps into the warning: the first, visible half-blink
    fixture.machine.render(0, 16);
    expect(titleTexts(fixture.render)).toEqual(['WARNING']);
    expect(fixture.render.drew(Palette.bossBarFrame)).toBe(false);
    advance(fixture, 60); // 70 steps in: the hidden half
    fixture.machine.render(0, 16);
    expect(titleTexts(fixture.render)).toEqual([]);
  });

  it('keeps WARNING steady with the blink effect off', () => {
    const fixture = warningFixture(false);
    advance(fixture, 370); // 70 steps into the warning: hidden when blinking
    fixture.machine.render(0, 16);
    expect(titleTexts(fixture.render)).toEqual(['WARNING']);
  });

  it('hides the banner under the pause, so it never sits under the pause menu', () => {
    const fixture = warningFixture();
    advance(fixture, IN_FIRST_BLINK);
    fixture.machine.step(DT, pressed(Button.Pause));
    expect(fixture.machine.scene).toBe(Scene.Paused);
    fixture.machine.render(0, 16);
    // The title font shows only the PAUSE header of the menu, never WARNING.
    expect(titleTexts(fixture.render)).toEqual(['PAUSE']);
    expect(fixture.render.drew(Palette.veil)).toBe(true);
  });

  it('shows only GAME OVER when the run ends during the warning, never the banner under it', () => {
    // A real run, advanced into the first, visible half-blink of its warning, behind a stub that
    // reports Game over on the next step: the scene machine must not draw both at the same centre.
    const real = new Run({ levels: [testScript([], { warningAt: 5, boss: STUB_BOSS })] });
    for (let i = 0; i < IN_FIRST_BLINK; i += 1) real.step(DT, createIntentFrame());
    expect(real.snapshot().boss.state).toBe(BossState.Warning);
    const ending = {
      step: (): void => undefined,
      outcome: (): RunOutcome => RunOutcome.GameOver,
      snapshot: () => real.snapshot(),
      events: () => real.events(),
      tally: () => real.tally(),
    };
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects({
        blink: true,
        hitFlash: true,
        explosions: true,
        shake: true,
        bombFlash: true,
        slowMotion: true,
        championName: true,
        graze: true,
        chainHints: true,
      }),
      () => ending,
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, createIntentFrame()); // the run's first step reports Game over
    expect(machine.scene).toBe(Scene.GameOver);
    machine.render(0, 16);
    expect(titleTexts(render)).toEqual(['GAME OVER']);
  });

  it('swaps the banner for the HP bar and the seconds when the boss enters', () => {
    const fixture = warningFixture();
    advance(fixture, 520); // 220 steps after the warning began: the entry has started
    fixture.machine.render(0, 16);
    expect(titleTexts(fixture.render)).toEqual([]);
    expect(fixture.render.drew(Palette.bossBarFrame)).toBe(true);
    const seconds = fixture.render.texts
      .filter((text) => text.y === 12 && text.font === 'hud')
      .sort((a, b) => a.x - b.x);
    expect(seconds.map((text) => `${text.text}@${String(text.x)}`)).toEqual(['9@218', '0@226']);
  });
});

/** A tap pressed and released at field y, in one step. */
function tapAt(y: number): IntentFrame {
  const tap = createIntentFrame();
  tap.tapRegion = 'field';
  tap.tapX = 120;
  tap.tapY = y;
  tap.releaseRegion = 'field';
  tap.releaseX = 120;
  tap.releaseY = y;
  return tap;
}

/**
 * A tap on the middle of row `row` of a menu of `rows` rows, centred on the field. The menus tapped
 * here have at most 7 rows under a header gap of 32 at most: their rows are all 32 px (GDD v0.25).
 */
function rowTap(row: number, rows: number): IntentFrame {
  const height = menuRowHeight(rows, MENU_HEADER_GAP.title);
  if (height !== 32)
    throw new Error(`rowTap assumes 32 px rows, not ${String(height)}: pass the gap`);
  return tapAt(menuTop(rows, height) + row * height + height / 2);
}

// The pause menu (Resume, Options, Quit) and Confirm quit (No, Yes).
const RESUME = (): IntentFrame => rowTap(0, 3);
const QUIT = (): IntentFrame => rowTap(2, 3);
const NO = (): IntentFrame => rowTap(0, 2);
const YES = (): IntentFrame => rowTap(1, 2);

/** Past a menu's opening guard (150 ms), with no input. */
function wait(fixture: ReturnType<typeof setup>): void {
  for (let i = 0; i < 10; i += 1) fixture.machine.step(DT, createIntentFrame());
}

function down(): IntentFrame {
  const step = createIntentFrame();
  step.moveKind = 'direction';
  step.moveY = 1;
  return step;
}

describe('SceneMachine — the pause menu and Confirm quit (GDD v0.13 §9.1, G1a)', () => {
  it('resumes by the Resume row, tapped once the menu is open', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    wait(fixture);
    fixture.machine.step(DT, RESUME());
    expect(fixture.machine.scene).toBe(Scene.CountIn);
  });

  it('opens Confirm quit from the Quit row, with No highlighted first', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, down());
    fixture.machine.step(DT, createIntentFrame());
    fixture.machine.step(DT, down());
    fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.scene).toBe(Scene.ConfirmQuit);
    fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.scene).toBe(Scene.Paused);
  });

  it.each([
    ['Back', frame(Button.Back)],
    ['the No row', NO()],
  ])('returns to Paused from Confirm quit on %s, the run kept', (_label, input) => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    wait(fixture);
    fixture.machine.step(DT, QUIT());
    wait(fixture);
    fixture.machine.step(DT, input);
    expect(fixture.machine.scene).toBe(Scene.Paused);
    fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.scene).toBe(Scene.CountIn);
  });

  it('never lets a doubled tap on Quit land on Yes, the row now in its place', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    for (let i = 0; i < 10; i += 1) fixture.machine.step(DT, createIntentFrame());
    // y 180 lies on Quit (y 176 to 207) and on Yes, the row in its place (y 160 to 191).
    fixture.machine.step(DT, tapAt(180)); // Quit
    expect(fixture.machine.scene).toBe(Scene.ConfirmQuit);
    fixture.machine.step(DT, tapAt(180)); // the bounce, where Yes now is
    expect(fixture.machine.scene).toBe(Scene.ConfirmQuit);
  });

  it('ignores Pause in Confirm quit', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    wait(fixture);
    fixture.machine.step(DT, QUIT());
    fixture.machine.step(DT, frame(Button.Pause));
    expect(fixture.machine.scene).toBe(Scene.ConfirmQuit);
  });

  it('discards the run on Yes and locks the title for 1 s', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    wait(fixture);
    fixture.machine.step(DT, QUIT());
    wait(fixture);
    fixture.machine.step(DT, YES());
    expect(fixture.machine.scene).toBe(Scene.Title);
    fixture.machine.render(1, 16);
    expect(fixture.render.drew(Palette.shipHull)).toBe(false);
    for (let i = 0; i < 60; i += 1) fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.scene).toBe(Scene.Title);
    fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.scene).toBe(Scene.Playing);
  });

  it('opens the pause menu on Resume each time', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, down());
    fixture.machine.step(DT, frame(Button.Back)); // resume, the highlight on Quit
    fixture.machine.step(DT, frame(Button.Pause)); // back to Paused from the count-in
    fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.scene).toBe(Scene.CountIn);
  });

  it('draws the question and the No and Yes rows in Confirm quit, without the pause button', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    wait(fixture);
    fixture.machine.step(DT, QUIT());
    fixture.machine.render(1, 16);
    const fieldTexts = fixture.render.texts
      .filter((text) => text.region === 'field')
      .map((text) => text.text);
    expect(fieldTexts).toEqual(['QUIT THE RUN', 'NO', 'YES']);
    expect(fixture.render.drew(Palette.pauseButton)).toBe(false);
  });
});

/** A scene host that records what the scene machine told it. */
class RecordingHost implements SceneHost {
  readonly saved: Options[] = [];
  readonly tables: (readonly HighScoreEntry[])[] = [];
  released = 0;
  country: string | undefined = undefined;
  preselectedCountry(): string | undefined {
    return this.country;
  }
  today(): string {
    return '2026-10-15';
  }
  highScoresChanged(entries: readonly HighScoreEntry[]): void {
    this.tables.push(entries);
  }
  startCapture(): void {
    // This host captures nothing.
  }
  captureNext(): BindingCapture {
    return NO_HOST.captureNext();
  }
  cancelCapture(): void {
    // Nothing to cancel.
  }
  keyLabel(): string {
    return '';
  }
  optionsChanged(options: Readonly<Options>): void {
    this.saved.push(structuredClone(options));
  }
  releaseMovement(): void {
    this.released += 1;
  }
}

function hosted(language: Options['language'] = 'en'): {
  machine: SceneMachine;
  render: RecordingRender;
  host: RecordingHost;
} {
  const render = new RecordingRender();
  const host = new RecordingHost();
  const machine = new SceneMachine(
    render,
    new Starfield(() => 0.5),
    { ...withEffects(ALL_ON), language },
    () => new Run(),
    host,
  );
  machine.step(DT, createIntentFrame()); // Boot → Title
  return { machine, render, host };
}

const ALL_ON: EffectSettings = {
  blink: true,
  hitFlash: true,
  explosions: true,
  shake: true,
  bombFlash: true,
  slowMotion: true,
  championName: true,
  graze: true,
  chainHints: true,
};

function idle(machine: SceneMachine, steps = 10): void {
  for (let i = 0; i < steps; i += 1) machine.step(DT, createIntentFrame());
}

function fieldTextsOf(render: RecordingRender): string[] {
  return render.texts.filter((text) => text.region === 'field').map((text) => text.text);
}

/** Moves the highlight down `rows` rows, releasing the key between presses. */
function downBy(machine: SceneMachine, rows: number): void {
  for (let i = 0; i < rows; i += 1) {
    machine.step(DT, down());
    machine.step(DT, createIntentFrame());
  }
}

function right(): IntentFrame {
  const step = createIntentFrame();
  step.moveKind = 'direction';
  step.moveX = 1;
  return step;
}

describe('SceneMachine — the options screens (GDD v0.14 §9.1, §9.3, G1a-3)', () => {
  it('opens Options from the title and returns to it on Back and on the Back row', () => {
    const { machine, render } = hosted();
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.TitleOptions);
    machine.render(0, 16);
    expect(fieldTextsOf(render)).toEqual([
      'OPTIONS',
      'VISUAL EFFECTS',
      'AUDIO',
      'CONTROLS',
      'AUTOFIRE',
      'OFF',
      'LANGUAGE',
      'ENGLISH',
      'COUNTRY',
      'FR',
      'FULLSCREEN',
      'OFF',
      'BACK',
    ]);
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.Title);
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm));
    idle(machine);
    machine.step(DT, rowTap(6, 7)); // Back
    expect(machine.scene).toBe(Scene.Title);
  });

  it('flips autofire on Confirm and on a new right direction, and tells the host each time', () => {
    const { machine, host } = hosted();
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm));
    downBy(machine, 3); // Autofire
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, right());
    expect(host.saved.map((options) => options.autofire)).toEqual([true, false]);
  });

  it('switches the language at once, the value written in its own language', () => {
    const { machine, render, host } = hosted();
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm));
    downBy(machine, 4); // Language
    machine.step(DT, pressed(Button.Confirm));
    machine.render(0, 16);
    expect(fieldTextsOf(render)).toContain('LANGUE');
    expect(fieldTextsOf(render)).toContain('FRANCAIS');
    expect(host.saved.at(-1)?.language).toBe('fr');
    machine.step(DT, pressed(Button.Back));
    machine.render(0, 16);
    expect(fieldTextsOf(render)).toEqual(['JOUER', 'MEILLEURS SCORES', 'OPTIONS']);
  });

  it('builds every menu with the gap its header takes (GDD v0.25 §9.1)', () => {
    const { machine } = hosted();
    // A private table read on purpose: the gap and the header font are declared apart.
    // eslint-disable-next-line @typescript-eslint/dot-notation -- bracket access reaches a private
    const screens = Object.values(machine['menuScreens']);
    expect(screens.length).toBeGreaterThan(8);
    for (const screen of screens) {
      const header = screen.header === undefined ? 0 : MENU_HEADER_GAP[screen.header.font];
      const gap = header + (screen.note === undefined ? 0 : MENU_ROW_HEIGHT);
      expect(screen.menu.headerGap).toBe(gap);
    }
  });

  it('draws the title rows 32 px tall and the twelve Visual effects rows 24 px (GDD v0.25, #95; v0.31 Graze, v0.32 Chain hints)', () => {
    const { machine, render } = hosted();
    machine.render(0, 16);
    expect(render.rectsOf(Palette.menuHighlight)).toMatchObject([{ y: 112, h: 32 }]);
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, pressed(Button.Confirm)); // Visual effects
    render.clear();
    machine.render(0, 16);
    // 12 rows of 24 px from y 16, the header line 16 px above the first row.
    expect(render.rectsOf(Palette.menuHighlight)).toMatchObject([{ y: 16, h: 24 }]);
    expect(render.texts.find((text) => text.text === 'VISUAL EFFECTS')?.y).toBe(0);
  });

  it('turns every effect off and on from Visual effects, one row flipping one switch', () => {
    const { machine, host } = hosted();
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, pressed(Button.Confirm)); // Visual effects
    expect(machine.scene).toBe(Scene.TitleEffects);
    downBy(machine, 1); // All off
    machine.step(DT, pressed(Button.Confirm));
    expect(host.saved.at(-1)?.effects).toEqual({
      blink: false,
      hitFlash: false,
      explosions: false,
      shake: false,
      bombFlash: false,
      slowMotion: false,
      championName: false,
      graze: false,
      chainHints: false,
    });
    downBy(machine, 2); // Hit flash
    machine.step(DT, right());
    expect(host.saved.at(-1)?.effects.hitFlash).toBe(true);
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.TitleOptions);
  });

  it('reaches the options from the pause with the run frozen, and Back returns to the pause', () => {
    const { machine } = hosted();
    machine.step(DT, pressed(Button.Confirm)); // Play
    machine.step(DT, pressed(Button.Pause));
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.PauseOptions);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.PauseEffects);
    machine.step(DT, pressed(Button.Back));
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.Paused);
    expect(machine.timeScale()).toBe(1);
  });

  it('applies an effect switch to the running presenter at once: no shake after All off', () => {
    const { machine, render } = hosted();
    machine.step(DT, pressed(Button.Confirm)); // Play
    machine.step(DT, pressed(Button.Pause));
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm)); // Options
    machine.step(DT, pressed(Button.Confirm)); // Visual effects
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm)); // All off
    machine.step(DT, pressed(Button.Back));
    machine.step(DT, pressed(Button.Back));
    machine.step(DT, pressed(Button.Confirm)); // Resume
    idle(machine, 200); // the count-in, then past the ship's fly-in: the bomb is usable
    expect(machine.scene).toBe(Scene.Playing);
    machine.step(DT, pressed(Button.Bomb));
    machine.render(1, 16);
    expect(render.camera).toEqual({ x: 0, y: 0 });
  });

  it('releases the movement on Play, on Resume and on Back from the pause', () => {
    const { machine, host } = hosted();
    machine.step(DT, pressed(Button.Confirm)); // Play
    expect(host.released).toBe(1);
    machine.step(DT, pressed(Button.Pause));
    machine.step(DT, pressed(Button.Confirm)); // Resume
    expect(host.released).toBe(2);
    idle(machine, 60);
    machine.step(DT, pressed(Button.Pause));
    machine.step(DT, pressed(Button.Back));
    expect(host.released).toBe(3);
  });

  it('ignores the whole title menu during the lock, highlight moves included', () => {
    const { machine } = gameOverFixture();
    for (let i = 0; i < 200 && machine.scene !== Scene.Title; i += 1) {
      machine.step(DT, createIntentFrame());
    }
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, down());
    machine.step(DT, createIntentFrame());
    idle(machine, 60);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Playing); // Play still highlighted: the down was ignored
  });
});

describe('SceneMachine — the controls screen (GDD v0.15 §4.2, G1b-3)', () => {
  function toControls(machine: SceneMachine): void {
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm)); // Options
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm)); // Controls
  }

  it('opens Controls from the options and returns to them on Back', () => {
    const { machine, render } = hosted();
    toControls(machine);
    expect(machine.scene).toBe(Scene.TitleControls);
    machine.render(0, 16);
    // The test host names no letter key (the adapter does): only the arrow shows on this row.
    expect(fieldTextsOf(render).slice(0, 5)).toEqual(['CONTROLS', 'KEYBOARD', 'UP', '↑', 'DOWN']);
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.TitleOptions);
  });

  it('hides the Controls row after a touch, and shows it again after a key', () => {
    const { machine, render } = hosted();
    idle(machine);
    const touch = rowTap(2, 3); // the title's Options row, by a finger
    touch.device = 'touch';
    machine.step(DT, touch);
    expect(machine.scene).toBe(Scene.TitleOptions);
    machine.render(0, 16);
    expect(fieldTextsOf(render)).not.toContain('CONTROLS');
    machine.step(DT, pressed(Button.Back)); // a key: the keyboard is the last device now
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm));
    machine.render(0, 16);
    expect(fieldTextsOf(render)).toContain('CONTROLS');
  });

  it('asks before restoring the defaults, No first, and comes back to the controls', () => {
    const { machine, host } = hosted();
    toControls(machine);
    downBy(machine, 7); // Restore defaults
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.TitleRestore);
    machine.step(DT, pressed(Button.Confirm)); // No
    expect(machine.scene).toBe(Scene.TitleControls);
    expect(host.saved).toHaveLength(0);
    downBy(machine, 7);
    machine.step(DT, pressed(Button.Confirm));
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm)); // Yes
    expect(machine.scene).toBe(Scene.TitleControls);
    expect(host.saved).toHaveLength(1);
  });

  it('stays on the cell when an automatic pause cancels a capture on the pause side', () => {
    const { machine } = hosted();
    machine.step(DT, pressed(Button.Confirm)); // Play
    machine.step(DT, pressed(Button.Pause));
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm)); // Options
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm)); // Controls
    downBy(machine, 4); // Fire
    machine.step(DT, pressed(Button.Confirm)); // the capture starts; this host cancels it at once
    machine.step(DT, pressed(Button.Pause)); // the automatic pause of a lost focus
    expect(machine.scene).toBe(Scene.PauseControls);
    machine.step(DT, pressed(Button.Confirm)); // still on Fire: a new capture, not another row
    expect(machine.scene).toBe(Scene.PauseControls);
  });

  it('reaches the controls from the pause with the run frozen', () => {
    const { machine } = hosted();
    machine.step(DT, pressed(Button.Confirm)); // Play
    machine.step(DT, pressed(Button.Pause));
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm)); // Options
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm)); // Controls
    expect(machine.scene).toBe(Scene.PauseControls);
    machine.step(DT, pressed(Button.Back));
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.Paused);
  });
});

describe('SceneMachine — the High scores screen (GDD v0.16 §9.1, G2-2)', () => {
  const ACE = { name: 'ACE', country: 'FR', score: 125400, level: 1, date: '2026-10-15' } as const;

  function withTable(): { machine: SceneMachine; render: RecordingRender } {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects(ALL_ON),
      () => new Run(),
      NO_HOST,
      [ACE],
    );
    machine.step(DT, createIntentFrame()); // Boot → Title
    return { machine, render };
  }

  it('opens from the High scores row of the title and lists the stored table, dashes after it', () => {
    const { machine, render } = withTable();
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.HighScores);
    machine.render(0, 16);
    const texts = fieldTextsOf(render);
    expect(texts.slice(0, 6)).toEqual(['HIGH SCORES', '1', 'ACE', 'FR', '125400', '1']);
    expect(texts).toContain('--------');
  });

  it('returns to a title locked for 1 s on back, confirm or a tap started here', () => {
    const { machine } = withTable();
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, pressed(Button.Back));
    expect(machine.scene).toBe(Scene.Title);
    for (let i = 0; i < 60; i += 1) machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Title);
  });

  it('ignores Pause', () => {
    const { machine } = withTable();
    downBy(machine, 1);
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, pressed(Button.Pause));
    expect(machine.scene).toBe(Scene.HighScores);
  });
});

describe('SceneMachine — the name entry (GDD v0.16 §9.1, SD-score, G2-3)', () => {
  const ACE: HighScoreEntry = { name: 'ACE', score: 9000, level: 1, date: '2026-10-14' };

  /** A run that ends in Game over on its first step with `score` points. */
  function losing(score: number): InRunStub {
    const real = new Run();
    return {
      step: (): void => undefined,
      outcome: (): RunOutcome => RunOutcome.GameOver,
      snapshot: () => ({ ...real.snapshot(), score }),
      events: () => real.events(),
      tally: () => real.tally(),
    };
  }
  type InRunStub = ConstructorParameters<typeof SceneMachine>[3] extends () => infer R ? R : never;

  /** Plays a run of `score` points to its Game over, then confirms past the 1 s lock. */
  function afterGameOver(score: number): {
    machine: SceneMachine;
    render: RecordingRender;
    host: RecordingHost;
  } {
    const render = new RecordingRender();
    const host = new RecordingHost();
    host.country = 'FR';
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects(ALL_ON),
      () => losing(score),
      host,
      [ACE],
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm)); // Play
    machine.step(DT, createIntentFrame()); // Game over
    for (let i = 0; i < 61; i += 1) machine.step(DT, pressed(Button.Confirm));
    return { machine, render, host };
  }

  /** Presses Confirm on each step, released in between: the grid picks the highlighted cell. */
  function confirm(machine: SceneMachine, times = 1): void {
    for (let i = 0; i < times; i += 1) {
      machine.step(DT, pressed(Button.Confirm));
      machine.step(DT, createIntentFrame());
    }
  }

  function upBy(machine: SceneMachine, rows: number): void {
    for (let i = 0; i < rows; i += 1) {
      const step = createIntentFrame();
      step.moveKind = 'direction';
      step.moveY = -1;
      machine.step(DT, step);
      machine.step(DT, createIntentFrame());
    }
  }

  it('opens after Game over when the score enters the table, with the heading and the grid', () => {
    const { machine, render } = afterGameOver(500);
    expect(machine.scene).toBe(Scene.NameEntry);
    machine.render(1, 16);
    const texts = fieldTextsOf(render);
    expect(texts.slice(0, 2)).toEqual(['YOUR NAME', '-']);
    expect(texts).toContain('SKIP');
    expect(render.drew(Palette.menuHighlight)).toBe(true);
  });

  it('keeps the starfield moving behind the grid', () => {
    const { machine, render } = afterGameOver(500);
    machine.render(1, 16);
    const stars = render.rectsOf(Palette.starNear).map((rect) => rect.y);
    for (let i = 0; i < 30; i += 1) machine.step(DT, createIntentFrame());
    machine.render(1, 16);
    expect(render.rectsOf(Palette.starNear).map((rect) => rect.y)).not.toEqual(stars);
  });

  it('goes to the title when the score does not enter the table', () => {
    const { machine } = afterGameOver(0);
    expect(machine.scene).toBe(Scene.Title);
  });

  it('records the entry with the saved country, saves the table, shows it highlighted', () => {
    const { machine, render, host } = afterGameOver(12000);
    confirm(machine, 2); // AA
    upBy(machine, 2); // SKIP, then the last grid row
    const left = createIntentFrame();
    left.moveKind = 'direction';
    left.moveX = -1;
    machine.step(DT, left); // wraps to OK, the row's last cell
    machine.step(DT, createIntentFrame());
    confirm(machine); // the name: the saved FR is copied, no country step (GDD v0.26)
    expect(machine.scene).toBe(Scene.HighScores);
    expect(host.tables).toEqual([
      [{ name: 'AA', score: 12000, level: 1, date: '2026-10-15', country: 'FR' }, ACE],
    ]);
    machine.render(1, 16);
    expect(fieldTextsOf(render).slice(0, 6)).toEqual([
      'HIGH SCORES',
      '1',
      'AA',
      'FR',
      '12000',
      '1',
    ]);
    expect(render.rectsOf(Palette.menuHighlight).map((rect) => rect.y)).toEqual([80]);
  });

  it('records nothing on SKIP and returns to a locked title', () => {
    const { machine, host } = afterGameOver(500);
    upBy(machine, 1); // SKIP
    confirm(machine);
    expect(machine.scene).toBe(Scene.Title);
    expect(host.tables).toEqual([]);
    // The step after SKIP's (its release) spent one of the 60 locked steps.
    for (let i = 0; i < 59; i += 1) machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Title);
  });

  it('ignores Pause; back deletes and never leaves', () => {
    const { machine } = afterGameOver(500);
    machine.step(DT, pressed(Button.Pause | Button.Back));
    machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.NameEntry);
  });

  it('follows the Ending card when a cleared run enters the table', () => {
    const { machine } = afterEnding();
    expect(machine.scene).toBe(Scene.NameEntry);
  });

  /** A run cleared at once (its score from the tally bonuses), past the Results and the card. */
  function afterEnding(): { machine: SceneMachine } {
    const real = new Run();
    const machine = new SceneMachine(
      new RecordingRender(),
      new Starfield(() => 0.5),
      withEffects(ALL_ON),
      () => ({
        step: (): void => undefined,
        outcome: (): RunOutcome => RunOutcome.RunCleared,
        snapshot: () => ({ ...real.snapshot(), score: 3000 }),
        events: () => real.events(),
        tally: () => real.tally(),
      }),
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, createIntentFrame()); // Results
    for (let i = 0; i < 480 + 360; i += 1) machine.step(DT, createIntentFrame());
    return { machine };
  }
});

describe('SceneMachine — the attract mode (GDD v0.16 §9.1, G2-3b)', () => {
  const IDLE_STEPS = 600;
  const ATTRACT_STEPS = 360;

  function idle(machine: SceneMachine, steps: number): void {
    for (let i = 0; i < steps; i += 1) machine.step(DT, createIntentFrame());
  }

  it('shows the high scores after 10 s on the title without input', () => {
    const { machine } = onTitle(); // the title's first step counts
    idle(machine, IDLE_STEPS - 2);
    expect(machine.scene).toBe(Scene.Title);
    idle(machine, 1);
    expect(machine.scene).toBe(Scene.Attract);
  });

  it('draws the table, dashes when empty, with no row highlighted', () => {
    const { machine, render } = onTitle();
    idle(machine, IDLE_STEPS);
    machine.render(0, 16);
    const texts = fieldTextsOf(render);
    expect(texts[0]).toBe('HIGH SCORES');
    expect(texts).toContain('--------');
    expect(render.drew(Palette.menuHighlight)).toBe(false);
  });

  it('returns to the title after 6 s, then starts again', () => {
    const { machine } = onTitle();
    idle(machine, IDLE_STEPS - 1 + ATTRACT_STEPS - 1);
    expect(machine.scene).toBe(Scene.Attract);
    idle(machine, 1);
    expect(machine.scene).toBe(Scene.Title);
    idle(machine, IDLE_STEPS);
    expect(machine.scene).toBe(Scene.Attract);
  });

  it('returns to an unlocked title on any input, which does nothing else', () => {
    const { machine } = onTitle();
    idle(machine, IDLE_STEPS);
    const confirm = pressed(Button.Confirm);
    confirm.active = true; // the adapter marks every physical input
    machine.step(DT, confirm);
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, createIntentFrame());
    machine.step(DT, confirm); // no 1 s lock: Play starts at once
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('restarts the 10 s on any physical input on the title, a mouse move included', () => {
    const { machine } = onTitle();
    idle(machine, IDLE_STEPS - 2); // one step short of the attract
    const move = createIntentFrame();
    move.active = true; // a mouse move anywhere on the page: no intent, only activity
    machine.step(DT, move);
    idle(machine, IDLE_STEPS - 1);
    expect(machine.scene).toBe(Scene.Title);
    idle(machine, 1);
    expect(machine.scene).toBe(Scene.Attract);
  });

  it('keeps showing on an automatic pause, returns on the Pause key', () => {
    const { machine } = onTitle();
    idle(machine, IDLE_STEPS);
    machine.step(DT, pressed(Button.Pause)); // focus lost: Pause without activity
    expect(machine.scene).toBe(Scene.Attract);
    const key = pressed(Button.Pause);
    key.active = true;
    machine.step(DT, key);
    expect(machine.scene).toBe(Scene.Title);
  });

  it('starts from the title only', () => {
    const { machine } = onTitle();
    downBy(machine, 2);
    machine.step(DT, pressed(Button.Confirm)); // Options
    idle(machine, IDLE_STEPS * 2);
    expect(machine.scene).toBe(Scene.TitleOptions);
  });
});

describe('SceneMachine — the champion name (GDD v0.22 §9.4.1)', () => {
  /** A run with no enemy and a far boss, played 41 s from the title; the name's texts drawn. */
  function farTexts(effects: EffectSettings, table: readonly HighScoreEntry[]): string[] {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects(effects),
      () => new Run({ levels: [testScript([], { warningAt: 100, boss: STUB_BOSS })] }),
      NO_HOST,
      table,
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm)); // Play
    for (let i = 0; i < 41 * 60; i += 1) machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Playing);
    machine.render(0, 16);
    return render.texts.filter((text) => text.font === 'far').map((text) => text.text);
  }

  it('draws the number 1 in the far font once the first pass has started', () => {
    expect(farTexts(ALL_ON, FULL_TABLE)).toEqual(['ACE']);
  });

  it('draws nothing with its switch off', () => {
    expect(farTexts({ ...ALL_ON, championName: false }, FULL_TABLE)).toEqual([]);
  });

  it('draws nothing with an empty table', () => {
    expect(farTexts(ALL_ON, [])).toEqual([]);
  });

  it('keeps the name, frozen, behind the pause', () => {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects(ALL_ON),
      () => new Run({ levels: [testScript([], { warningAt: 100, boss: STUB_BOSS })] }),
      NO_HOST,
      FULL_TABLE,
    );
    machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Confirm)); // Play
    for (let i = 0; i < 41 * 60; i += 1) machine.step(DT, createIntentFrame());
    machine.step(DT, pressed(Button.Pause));
    expect(machine.scene).toBe(Scene.Paused);
    machine.render(0, 16);
    const first = render.texts.find((text) => text.font === 'far');
    for (let i = 0; i < 60; i += 1) machine.step(DT, createIntentFrame());
    machine.render(0, 16);
    expect(first?.text).toBe('ACE');
    expect(render.texts.find((text) => text.font === 'far')).toEqual(first);
  });

  it('draws nothing on the title', () => {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects(ALL_ON),
      () => new Run(),
      NO_HOST,
      FULL_TABLE,
    );
    for (let i = 0; i < 41 * 60; i += 1) machine.step(DT, createIntentFrame());
    machine.render(0, 16);
    expect(render.texts.some((text) => text.font === 'far')).toBe(false);
  });
});

describe('SceneMachine — the country first (GDD v0.26 §9.1, ADR-0027)', () => {
  /** A hosted machine on the title, its save holding `country`. */
  function withCountry(country: Options['country']): ReturnType<typeof hosted> {
    const render = new RecordingRender();
    const host = new RecordingHost();
    host.country = 'FR';
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      { ...withEffects(ALL_ON), country },
      () => new Run(),
      host,
    );
    machine.step(DT, createIntentFrame()); // Boot → Title
    idle(machine, 70); // past the title's input lock
    return { machine, render, host };
  }

  function press(machine: SceneMachine, button: number): void {
    machine.step(DT, pressed(button));
    machine.step(DT, createIntentFrame());
  }

  it('asks the country at Play while none is saved, preselected from the language', () => {
    const { machine, render } = withCountry(undefined);
    press(machine, Button.Confirm);
    expect(machine.scene).toBe(Scene.StartCountry);
    machine.render(1, 16);
    expect(fieldTextsOf(render).slice(0, 3)).toEqual(['COUNTRY', 'F', 'R']);
  });

  it('saves the chosen code, then starts the run', () => {
    const { machine, host } = withCountry(undefined);
    press(machine, Button.Confirm);
    press(machine, Button.Confirm); // OK, preselected for the known FR
    expect(host.saved.map((options) => options.country)).toEqual(['FR']);
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('returns to the title and saves nothing on back with an empty code', () => {
    const { machine, host } = withCountry(undefined);
    press(machine, Button.Confirm);
    press(machine, Button.Back);
    press(machine, Button.Back); // the code is empty
    expect(machine.scene).toBe(Scene.StartCountry);
    press(machine, Button.Back);
    expect(machine.scene).toBe(Scene.Title);
    expect(host.saved).toEqual([]);
  });

  it('starts the run at once when a choice is saved, even none', () => {
    const { machine } = withCountry('none');
    press(machine, Button.Confirm);
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('opens the country from the options on the saved code and returns there', () => {
    const { machine, render, host } = withCountry('DE');
    downBy(machine, 2);
    press(machine, Button.Confirm); // Options
    idle(machine);
    downBy(machine, 5); // the Country row
    press(machine, Button.Confirm);
    expect(machine.scene).toBe(Scene.TitleCountry);
    machine.render(1, 16);
    expect(fieldTextsOf(render).slice(0, 3)).toEqual(['COUNTRY', 'D', 'E']);
    press(machine, Button.Confirm); // OK on the saved code
    expect(machine.scene).toBe(Scene.TitleOptions);
    expect(host.saved.map((options) => options.country)).toEqual(['DE']);
  });

  it('ignores left and right on the Country row', () => {
    const { machine } = withCountry('DE');
    downBy(machine, 2);
    press(machine, Button.Confirm);
    idle(machine);
    downBy(machine, 5);
    machine.step(DT, right());
    machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.TitleOptions);
  });

  it('saves none on NONE at the start, then starts the run', () => {
    const { machine, host } = withCountry(undefined);
    press(machine, Button.Confirm);
    const none = createIntentFrame();
    none.hovered = true;
    none.hoverX = 120;
    none.hoverY = 104 + 3 * 32 + 16; // NONE, row 3, columns 3 and 4
    machine.step(DT, none);
    press(machine, Button.Confirm);
    expect(host.saved.map((options) => options.country)).toEqual(['none']);
    expect(machine.scene).toBe(Scene.Playing);
  });

  it('returns to the options and saves nothing on back with an empty code', () => {
    const { machine, host } = withCountry('DE');
    downBy(machine, 2);
    press(machine, Button.Confirm);
    idle(machine);
    downBy(machine, 5);
    press(machine, Button.Confirm);
    press(machine, Button.Back);
    press(machine, Button.Back);
    press(machine, Button.Back);
    expect(machine.scene).toBe(Scene.TitleOptions);
    expect(host.saved).toEqual([]);
  });

  it('opens the country from the pause options and returns there, the run frozen', () => {
    const { machine, host } = withCountry('DE');
    press(machine, Button.Confirm); // Play
    machine.step(DT, pressed(Button.Pause));
    downBy(machine, 1);
    press(machine, Button.Confirm); // Options
    idle(machine);
    downBy(machine, 5);
    press(machine, Button.Confirm);
    expect(machine.scene).toBe(Scene.PauseCountry);
    press(machine, Button.Confirm); // OK on DE
    expect(machine.scene).toBe(Scene.PauseOptions);
    expect(host.saved.map((options) => options.country)).toEqual(['DE']);
  });

  it('shows -- on the Country row while no country is chosen', () => {
    const { machine, render } = withCountry('none');
    downBy(machine, 2);
    press(machine, Button.Confirm);
    idle(machine);
    machine.render(1, 16);
    const texts = fieldTextsOf(render);
    expect(texts[texts.indexOf('COUNTRY') + 1]).toBe('--');
  });
});

const ACE_ENTRY: HighScoreEntry = { name: 'ACE', score: 9000, level: 1, date: '2026-10-14' };

describe('SceneMachine — the feedback form (GDD v0.26 §9.1, ADR-0027)', () => {
  const FORM = 'https://tally.so/r/abc123';

  /** Stands for the browser's link: records the armings, serves the outcome a test sets. */
  class FakeLink implements LinkPort {
    readonly armings: (ArmedLink | undefined)[] = [];
    outcome: LinkOutcome = 'none';
    arm(link: ArmedLink | undefined): void {
      this.armings.push(link);
    }
    takeOutcome(): LinkOutcome {
      const outcome = this.outcome;
      this.outcome = 'none';
      return outcome;
    }
    get armed(): ArmedLink | undefined {
      return this.armings[this.armings.length - 1];
    }
  }

  /** A run that ends in Game over on its first step with `score` points. */
  function losing(score: number): ReturnType<ConstructorParameters<typeof SceneMachine>[3]> {
    const real = new Run();
    return {
      step: (): void => undefined,
      outcome: (): RunOutcome => RunOutcome.GameOver,
      snapshot: () => ({ ...real.snapshot(), score }),
      events: () => real.events(),
      tally: () => real.tally(),
    };
  }

  interface Fixture {
    machine: SceneMachine;
    render: RecordingRender;
    host: RecordingHost;
    link: FakeLink;
  }

  /** A hosted machine on its title, the form on (`form`) or off (`''`), past the title's lock. */
  function onTitleWith(form: string, table: readonly HighScoreEntry[] = FULL_TABLE): Fixture {
    const render = new RecordingRender();
    const host = new RecordingHost();
    const link = new FakeLink();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      withEffects(ALL_ON),
      () => losing(321),
      host,
      table,
      { feedback: { form, version: '0.26.1', link } },
    );
    machine.step(DT, createIntentFrame()); // Boot → Title
    idle(machine, 70);
    return { machine, render, host, link };
  }

  function press(machine: SceneMachine, button: number): void {
    machine.step(DT, pressed(button));
    machine.step(DT, createIntentFrame());
  }

  /** From the title: a run ends in Game over, then Confirm past its 1 s lock. */
  function afterRun(fixture: Fixture): void {
    const { machine } = fixture;
    press(machine, Button.Confirm); // Play (the saved country is FR)
    machine.step(DT, createIntentFrame()); // Game over
    for (let i = 0; i < 80 && machine.scene === Scene.GameOver; i += 1) {
      machine.step(DT, pressed(Button.Confirm));
    }
  }

  /** A fixture on the feedback offer after a run that does not enter the full table. */
  function onOffer(): Fixture {
    const fixture = onTitleWith(FORM);
    afterRun(fixture);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
    idle(fixture.machine, 70); // past the offer's 1 s lock, as on the title
    return fixture;
  }

  /** A fixture on the title with the highlight on its FEEDBACK row. */
  function onFeedbackRow(): Fixture {
    const fixture = onTitleWith(FORM);
    downBy(fixture.machine, 3);
    return fixture;
  }

  function blockedShown(fixture: Fixture): boolean {
    fixture.render.texts.length = 0;
    fixture.machine.render(1, 16);
    return fieldTextsOf(fixture.render).includes('OPEN BLOCKED');
  }

  describe('the title row', () => {
    it('shows a FEEDBACK row last when the build holds a form address', () => {
      const { machine, render } = onTitleWith(FORM);
      machine.render(1, 16);
      expect(fieldTextsOf(render)).toEqual(['PLAY', 'HIGH SCORES', 'OPTIONS', 'FEEDBACK']);
    });

    it('shows no FEEDBACK row without a form address', () => {
      const { machine, render, link } = onTitleWith('');
      machine.render(1, 16);
      expect(fieldTextsOf(render)).toEqual(['PLAY', 'HIGH SCORES', 'OPTIONS']);
      expect(link.armings).toEqual([]);
    });

    it('arms the link on the title: a lift over the row opens, Enter only while highlighted', () => {
      const { link, machine } = onTitleWith(FORM);
      expect(link.armed).toMatchObject({ keys: 'none' });
      downBy(machine, 3);
      expect(link.armed).toMatchObject({ keys: 'confirm' });
      downBy(machine, 1); // wraps to Play
      expect(link.armed).toMatchObject({ keys: 'none' });
    });

    it('sends the run context in the address: the set, version, country, language', () => {
      const { link } = onTitleWith(FORM);
      expect(link.armed?.url).toBe(
        `${FORM}?set=1&version=0.26.1&score=0&level=1&country=FR&device=keyboard&lang=en`,
      );
    });

    it('rebuilds the address when the device changes: a touch player sends touch', () => {
      const { machine, link } = onTitleWith(FORM);
      machine.step(DT, { ...frame(0), device: 'touch' });
      expect(link.armed?.url).toContain('device=touch');
    });

    it('keeps an opening made by the input that changed the device (the gesture prompt)', () => {
      const { machine, host, link } = onTitleWith(FORM);
      link.outcome = 'opened';
      machine.step(DT, { ...frame(0), device: 'touch' });
      expect(host.saved.map((options) => options.feedbackCount)).toEqual([1]);
    });

    it('counts and saves an opening, and stays on the title', () => {
      const { machine, host, link } = onFeedbackRow();
      link.outcome = 'opened';
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.Title);
      expect(host.saved.map((options) => options.feedbackCount)).toEqual([1]);
    });

    it('rebuilds the address after an opening: the second one shows set 2', () => {
      const { machine, link } = onFeedbackRow();
      expect(link.armed?.url).toContain('set=1');
      link.outcome = 'opened';
      press(machine, Button.Confirm); // its release step arms the title again
      expect(link.armed?.url).toContain('set=2');
    });

    it('counts an opened tab even when no row was activated, as on a lift the menu ignored', () => {
      const { machine, host, link } = onTitleWith(FORM); // the highlight is on Play
      link.outcome = 'opened';
      idle(machine, 1);
      expect(machine.scene).toBe(Scene.Title);
      expect(host.saved.map((options) => options.feedbackCount)).toEqual([1]);
    });

    it('shows OPEN BLOCKED for two seconds after a refused tab, counting nothing', () => {
      const fixture = onFeedbackRow();
      fixture.link.outcome = 'refused';
      press(fixture.machine, Button.Confirm);
      expect(fixture.machine.scene).toBe(Scene.Title);
      expect(fixture.host.saved).toEqual([]);
      expect(blockedShown(fixture)).toBe(true);
      idle(fixture.machine, 125);
      expect(blockedShown(fixture)).toBe(false);
    });

    it('asks for a tap, click or key when no opening happened, as with a gamepad', () => {
      const { machine, host } = onFeedbackRow();
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.FeedbackGesture);
      expect(host.saved).toEqual([]);
    });
  });

  describe('the offer after a run', () => {
    it('shows after a run end that does not enter the table', () => {
      const { machine } = onOffer();
      expect(machine.scene).toBe(Scene.FeedbackOffer);
    });

    it('draws the heading, the note and its two rows', () => {
      const { machine, render } = onOffer();
      machine.render(1, 16);
      expect(fieldTextsOf(render)).toEqual([
        '2 QUICK QUESTIONS',
        'YOUR OPINION',
        'GIVE FEEDBACK',
        'LATER',
      ]);
    });

    it('sends the score of the run just ended in the address', () => {
      const { link } = onOffer();
      expect(link.armed?.url).toContain('score=321');
    });

    it('arms Enter on GIVE FEEDBACK only, and a lift over its row always', () => {
      const { machine, link } = onOffer();
      expect(link.armed).toMatchObject({ keys: 'confirm' });
      downBy(machine, 1);
      expect(link.armed).toMatchObject({ keys: 'none' });
      expect(link.armed?.band).toBeDefined();
    });

    it('is not offered when the build holds no form address', () => {
      const fixture = onTitleWith('');
      afterRun(fixture);
      expect(fixture.machine.scene).toBe(Scene.Title);
    });

    it('counts an opened tab even when no row was activated', () => {
      const { machine, host, link } = onOffer();
      link.outcome = 'opened';
      idle(machine, 1);
      expect(machine.scene).toBe(Scene.Title);
      expect(host.saved.map((options) => options.feedbackCount)).toEqual([1]);
    });

    it('ignores Confirm and arms nothing during its 1 s lock', () => {
      const fixture = onTitleWith(FORM);
      afterRun(fixture);
      expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
      expect(fixture.link.armed).toBeUndefined();
      for (let i = 0; i < 30; i += 1) fixture.machine.step(DT, pressed(Button.Confirm));
      expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
      idle(fixture.machine, 40);
      expect(fixture.link.armed).toMatchObject({ keys: 'confirm' });
    });

    it('leaves to the title on LATER, nothing counted, nothing armed', () => {
      const { machine, host, link } = onOffer();
      downBy(machine, 1);
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.Title);
      expect(host.saved).toEqual([]);
      expect(link.armed).toBeUndefined();
    });

    it('leaves to the title on back', () => {
      const { machine } = onOffer();
      press(machine, Button.Back);
      expect(machine.scene).toBe(Scene.Title);
    });

    it('ignores Pause', () => {
      const { machine } = onOffer();
      press(machine, Button.Pause);
      expect(machine.scene).toBe(Scene.FeedbackOffer);
    });

    it('leaves to the title after 20 s without input', () => {
      const { machine } = onOffer();
      idle(machine, 20 * 60 - 80);
      expect(machine.scene).toBe(Scene.FeedbackOffer);
      idle(machine, 20);
      expect(machine.scene).toBe(Scene.Title);
    });

    it('restarts the 20 s on every input', () => {
      const { machine } = onOffer();
      idle(machine, 20 * 60 - 100);
      const active = createIntentFrame();
      active.active = true;
      machine.step(DT, active);
      idle(machine, 20 * 60 - 100);
      expect(machine.scene).toBe(Scene.FeedbackOffer);
    });

    it('counts and saves an opening, then returns to the title', () => {
      const { machine, host, link } = onOffer();
      link.outcome = 'opened';
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.Title);
      expect(host.saved.map((options) => options.feedbackCount)).toEqual([1]);
    });

    it('rotates the question set with each opening', () => {
      const first = onOffer();
      first.link.outcome = 'opened';
      press(first.machine, Button.Confirm);
      idle(first.machine, 70);
      afterRun(first);
      idle(first.machine, 70); // past the offer's lock, it arms
      expect(first.link.armed?.url).toContain('set=2');
    });

    it('shows OPEN BLOCKED over the offer after a refused tab, and stays', () => {
      const fixture = onOffer();
      fixture.link.outcome = 'refused';
      press(fixture.machine, Button.Confirm);
      expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
      expect(fixture.host.saved).toEqual([]);
      expect(blockedShown(fixture)).toBe(true);
      idle(fixture.machine, 125);
      expect(blockedShown(fixture)).toBe(false);
    });

    it('asks for a gesture when no opening happened', () => {
      const { machine } = onOffer();
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.FeedbackGesture);
    });

    it('follows SKIP on the name entry', () => {
      const fixture = onTitleWith(FORM, [ACE_ENTRY]);
      afterRun(fixture);
      expect(fixture.machine.scene).toBe(Scene.NameEntry);
      const up = createIntentFrame();
      up.moveKind = 'direction';
      up.moveY = -1;
      fixture.machine.step(DT, up); // SKIP
      fixture.machine.step(DT, createIntentFrame());
      press(fixture.machine, Button.Confirm);
      expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
    });

    it('follows the high scores shown after a name was entered', () => {
      const fixture = onTitleWith(FORM, [ACE_ENTRY]);
      afterRun(fixture);
      const { machine } = fixture;
      press(machine, Button.Confirm); // A
      press(machine, Button.Confirm); // A
      const up = createIntentFrame();
      up.moveKind = 'direction';
      up.moveY = -1;
      machine.step(DT, up);
      machine.step(DT, createIntentFrame());
      machine.step(DT, up);
      machine.step(DT, createIntentFrame());
      const left = createIntentFrame();
      left.moveKind = 'direction';
      left.moveX = -1;
      machine.step(DT, left); // OK
      machine.step(DT, createIntentFrame());
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.HighScores);
      idle(machine, 70);
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.FeedbackOffer);
    });

    it('does not offer after the high scores opened from the title', () => {
      const { machine } = onTitleWith(FORM);
      downBy(machine, 1);
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.HighScores);
      idle(machine);
      press(machine, Button.Confirm);
      expect(machine.scene).toBe(Scene.Title);
    });
  });

  describe('the gesture prompt', () => {
    function onGesture(): Fixture {
      const fixture = onOffer();
      press(fixture.machine, Button.Confirm);
      expect(fixture.machine.scene).toBe(Scene.FeedbackGesture);
      return fixture;
    }

    it('draws the prompt and arms any tap, click or key', () => {
      const { machine, render, link } = onGesture();
      machine.render(1, 16);
      expect(fieldTextsOf(render)).toEqual(['TAP OR PRESS A KEY']);
      expect(link.armed).toMatchObject({ band: undefined, keys: 'any' });
    });

    it('counts, saves and returns to the title when the gesture opened the form', () => {
      const { machine, host, link } = onGesture();
      link.outcome = 'opened';
      idle(machine, 1);
      expect(machine.scene).toBe(Scene.Title);
      expect(host.saved.map((options) => options.feedbackCount)).toEqual([1]);
    });

    it('stays while nothing happens', () => {
      const { machine } = onGesture();
      idle(machine, 300);
      expect(machine.scene).toBe(Scene.FeedbackGesture);
    });

    it('returns to the title on back, counting nothing', () => {
      const { machine, host } = onGesture();
      press(machine, Button.Back);
      expect(machine.scene).toBe(Scene.Title);
      expect(host.saved).toEqual([]);
    });

    it('returns to the title with OPEN BLOCKED after a refusal', () => {
      const fixture = onGesture();
      fixture.link.outcome = 'refused';
      idle(fixture.machine, 1);
      expect(fixture.machine.scene).toBe(Scene.Title);
      expect(fixture.host.saved).toEqual([]);
      expect(blockedShown(fixture)).toBe(true);
    });

    it('returns to the title from the title row and counts there too', () => {
      const fixture = onFeedbackRow();
      press(fixture.machine, Button.Confirm); // no opening: the prompt
      expect(fixture.machine.scene).toBe(Scene.FeedbackGesture);
      fixture.link.outcome = 'opened';
      idle(fixture.machine, 1);
      expect(fixture.machine.scene).toBe(Scene.Title);
      expect(fixture.host.saved.map((options) => options.feedbackCount)).toEqual([1]);
    });
  });
});
