import { describe, expect, it } from 'vitest';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { Palette } from '../../src/domain/presentation/palette';
import { Starfield } from '../../src/domain/presentation/starfield';
import { DIVER, POPCORN } from '../../src/domain/game/enemy';
import type { LevelScript } from '../../src/domain/game/level-script';
import { NoAttack } from '../../src/domain/game/attacks';
import type { BossDefinition } from '../../src/domain/game/boss';
import { swayMovement } from '../../src/domain/game/movements';
import { Run } from '../../src/domain/game/run';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';
import { PORTRAIT } from '../../src/domain/presentation/screen';
import { RecordingRender } from '../support/recording-render';
import type { RecordedRect } from '../support/recording-render';
import { STUB_BOSS, testScript } from '../support/script';

const DT = 1 / 60;

function setup(): { machine: SceneMachine; render: RecordingRender } {
  const render = new RecordingRender();
  const machine = new SceneMachine(
    render,
    new Starfield(() => 0.5),
    {
      blink: true,
      hitFlash: true,
      explosions: true,
      shake: true,
      bombFlash: true,
    },
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

  it.each([
    ['Confirm pressed', pressed(Button.Confirm)],
    ['a tap or click', tapped()],
  ])('starts a run from the title on %s', (_label, frame) => {
    const { machine } = onTitle();
    machine.step(DT, frame);
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

  it('keeps the time scale at 1 in Paused and Count-in', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    expect(fixture.machine.timeScale()).toBe(1);
    fixture.machine.step(DT, frame(Button.Confirm));
    expect(fixture.machine.timeScale()).toBe(1);
  });

  it('draws the veil and the pause icon in Paused, the digits in Count-in', () => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.render(1, 16);
    expect(fixture.render.drew(Palette.veil)).toBe(true);
    expect(fixture.render.drew(Palette.pauseIcon)).toBe(true);
    const fieldTexts = (): string[] =>
      fixture.render.texts.filter((text) => text.region === 'field').map((text) => text.text);
    expect(fieldTexts()).toEqual([]);
    fixture.machine.step(DT, frame(Button.Confirm));
    fixture.machine.render(1, 16);
    expect(fieldTexts()).toEqual(['3']);
    expect(fixture.render.drew(Palette.pauseIcon)).toBe(false);
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
    { blink: true, hitFlash: true, explosions: true, shake: true, bombFlash: true },
    () => new Run({ script: KILLER }),
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
    for (let i = 0; i < 60; i += 1) machine.step(DT, tapped());
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, tapped());
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
      { blink: true, hitFlash: true, explosions: true, shake: true, bombFlash: true },
      () => new Run({ script: TARGET }),
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
      { blink: true, hitFlash: true, explosions: true, shake: true, bombFlash: true },
      () => new Run({ script: script }),
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
  it('never locks the first title: a tap starts a run at once', () => {
    const { machine } = onTitle();
    machine.step(DT, OTHER_HUD_TAP);
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

  it.each([
    ['the pause button', PAUSE_TAP],
    ['another HUD tap', OTHER_HUD_TAP],
    ['a field tap', tapped()],
  ])('starts the count-in on a tap on %s in Paused (interim tap resume)', (_label, tap) => {
    const fixture = playing();
    fixture.machine.step(DT, frame(Button.Pause));
    fixture.machine.step(DT, tap);
    expect(fixture.machine.scene).toBe(Scene.CountIn);
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

describe('SceneMachine — Results, interim banner (meta/05-state-scenes, F-2a)', () => {
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

  function clearedFixture(): ReturnType<typeof setup> {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      { blink: true, hitFlash: true, explosions: true, shake: true, bombFlash: true },
      () => new Run({ script: testScript([], { warningAt: 5, boss: GLASS }) }),
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

  it('shows LEVEL CLEAR from the catalogue, centred in the title font, over a veil', () => {
    const { machine, render } = clearedFixture();
    machine.render(0, 16);
    expect(render.drew(Palette.veil)).toBe(true);
    expect(render.texts.filter((text) => text.font === 'title')).toEqual([
      { region: 'field', x: 34, y: 150, text: 'LEVEL CLEAR', font: 'title' },
    ]);
  });

  it('keeps the starfield moving over the frozen run', () => {
    const { machine, render } = clearedFixture();
    machine.render(0, 16);
    const stars = render.rectsOf(Palette.starNear).map((rect) => rect.y);
    for (let i = 0; i < 30; i += 1) machine.step(DT, createIntentFrame());
    machine.render(0, 16);
    expect(render.rectsOf(Palette.starNear).map((rect) => rect.y)).not.toEqual(stars);
  });

  it('returns to the title after 3 s (180 steps), whatever is pressed', () => {
    const { machine } = clearedFixture();
    for (let i = 0; i < 179; i += 1) {
      machine.step(DT, pressed(Button.Confirm | Button.Pause | Button.Back));
    }
    expect(machine.scene).toBe(Scene.Results);
    machine.step(DT, createIntentFrame());
    expect(machine.scene).toBe(Scene.Title);
  });

  it('locks the title reached from Results for 1 s, so a held Confirm never starts a run', () => {
    const { machine } = clearedFixture();
    for (let i = 0; i < 180; i += 1) machine.step(DT, createIntentFrame());
    for (let i = 0; i < 60; i += 1) machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Title);
    machine.step(DT, pressed(Button.Confirm));
    expect(machine.scene).toBe(Scene.Playing);
  });
});

describe('SceneMachine — the boss HUD (meta/05-state-scenes, F-2b)', () => {
  /** A run whose boss warns at 5 s (the director's minimum is above 4 s): the WARNING lasts about
   * 180 steps from step 300, then the entry about 180 more. */
  function warningFixture(blink = true): ReturnType<typeof setup> {
    const render = new RecordingRender();
    const machine = new SceneMachine(
      render,
      new Starfield(() => 0.5),
      { blink, hitFlash: true, explosions: true, shake: true, bombFlash: true },
      () => new Run({ script: testScript([], { warningAt: 5, boss: STUB_BOSS }) }),
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
    advance(fixture, 310); // 10 steps into the warning: the first, visible half of the first blink
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

  it('freezes the banner with the pause, under the veil', () => {
    const fixture = warningFixture();
    advance(fixture, 310);
    fixture.machine.step(DT, pressed(Button.Pause));
    expect(fixture.machine.scene).toBe(Scene.Paused);
    fixture.machine.render(0, 16);
    expect(titleTexts(fixture.render)).toEqual(['WARNING']);
    expect(fixture.render.drew(Palette.veil)).toBe(true);
  });

  it('swaps the banner for the HP bar and the seconds when the boss enters', () => {
    const fixture = warningFixture();
    advance(fixture, 520); // 220 steps after the warning began: the entry has started
    fixture.machine.render(0, 16);
    expect(titleTexts(fixture.render)).toEqual([]);
    expect(fixture.render.drew(Palette.bossBarFrame)).toBe(true);
    expect(fixture.render.texts.filter((text) => text.y === 12)).toHaveLength(2);
  });
});
