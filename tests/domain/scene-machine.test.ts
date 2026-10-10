import { describe, expect, it } from 'vitest';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { Palette } from '../../src/domain/presentation/palette';
import { Starfield } from '../../src/domain/presentation/starfield';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';
import { RecordingRender } from '../support/recording-render';
import type { RecordedRect } from '../support/recording-render';

const DT = 1 / 60;

function setup(): { machine: SceneMachine; render: RecordingRender } {
  const render = new RecordingRender();
  const machine = new SceneMachine(render, new Starfield(() => 0.5), { blink: true });
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
    expect(frozen).toBeDefined();
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
    expect(fixture.render.texts).toEqual([]);
    fixture.machine.step(DT, frame(Button.Confirm));
    fixture.machine.render(1, 16);
    expect(fixture.render.texts.map((text) => text.text)).toEqual(['3']);
    expect(fixture.render.drew(Palette.pauseIcon)).toBe(false);
  });
});
