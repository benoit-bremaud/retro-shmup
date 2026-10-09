import { describe, expect, it } from 'vitest';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import type { RenderPort, RenderRegion } from '../../src/domain/ports/render-port';
import { Palette } from '../../src/domain/presentation/palette';
import { Starfield } from '../../src/domain/presentation/starfield';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';

const DT = 1 / 60;

/** Records the colours drawn per region, and how many frames were presented. */
class RecordingRender implements RenderPort {
  private region: RenderRegion = 'hud';
  readonly colours: { region: RenderRegion; colour: string }[] = [];
  presented = 0;
  setRegion(region: RenderRegion): void {
    this.region = region;
  }
  clear(): void {
    this.colours.length = 0;
  }
  drawSprite(): void {
    throw new Error('no sprite before the assets brick');
  }
  drawRect(_x: number, _y: number, _w: number, _h: number, colour: string): void {
    this.colours.push({ region: this.region, colour });
  }
  drawText(): void {
    throw new Error('no text before the screens brick');
  }
  setCameraOffset(): void {
    // Not used by the scenes yet.
  }
  present(): void {
    this.presented += 1;
  }
  drew(colour: string): boolean {
    return this.colours.some((entry) => entry.colour === colour);
  }
}

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

  it('ignores Pause in play until the Paused scene lands (interim deviation, pinned)', () => {
    // Remove this test, on purpose, when Paused and Count-in arrive (05-state-scenes).
    const { machine } = onTitle();
    machine.step(DT, pressed(Button.Confirm));
    machine.step(DT, pressed(Button.Pause));
    expect(machine.scene).toBe(Scene.Playing);
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
