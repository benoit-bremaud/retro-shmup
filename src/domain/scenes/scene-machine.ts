import { Run, RunOutcome } from '../game/run';
import type { RunView, Simulation } from '../game/run';
import { SceneTuning, STEP_SECONDS, toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { RenderPort } from '../ports/render-port';
import { drawCountIn, drawPauseIcon, drawVeil } from '../presentation/overlays';
import { Palette } from '../presentation/palette';
import { RunPresenter } from '../presentation/run-presenter';
import type { EffectSettings } from '../presentation/run-presenter';
import { FIELD_WIDTH, FIELD_X, HUD_BAND_WIDTH, SCREEN_HEIGHT } from '../presentation/screen';
import type { Starfield } from '../presentation/starfield';

/** The scenes built so far (meta/05-state-scenes, build order). */
export const Scene = {
  Boot: 'BOOT',
  Title: 'TITLE',
  Playing: 'PLAYING',
  Paused: 'PAUSED',
  CountIn: 'COUNT_IN',
  GameOver: 'GAME_OVER',
} as const;
export type Scene = (typeof Scene)[keyof typeof Scene];

/** What differs between scenes for drawing, read by `render`. */
interface SceneTraits {
  /** The run does not step and the frame draws at alpha 1. */
  readonly frozen: boolean;
  /** The background clock advances. */
  readonly scrolls: boolean;
  readonly drawsRun: boolean;
}

const SCENE_TRAITS: Readonly<Record<Scene, SceneTraits>> = {
  [Scene.Boot]: { frozen: false, scrolls: false, drawsRun: false },
  [Scene.Title]: { frozen: false, scrolls: true, drawsRun: false },
  [Scene.Playing]: { frozen: false, scrolls: true, drawsRun: true },
  [Scene.Paused]: { frozen: true, scrolls: false, drawsRun: true },
  [Scene.CountIn]: { frozen: true, scrolls: false, drawsRun: true },
  [Scene.GameOver]: { frozen: true, scrolls: false, drawsRun: true },
};

const COUNT_IN_STEPS = toSteps(SceneTuning.countInSeconds);
const GAME_OVER_STEPS = toSteps(SceneTuning.gameOverSeconds);

/** What the scene machine holds of a run: it steps it and reads it, nothing more. */
type InRun = Simulation & RunView;

/**
 * The screens and their transitions (meta/05-state-scenes): Boot → Title → InRun { Playing ⇄
 * Paused ⇄ Count-in } → Game over → Title. The finished run stays read-only until the title. It
 * satisfies the frame loop's `FrameTarget` structurally, so the domain
 * never imports the loop. It owns the background clock, so the starfield scrolls on the title and
 * in play without a jump at the start, and freezes with the run.
 */
export class SceneMachine {
  private current: Scene = Scene.Boot;
  private run: InRun | undefined;
  private backgroundSteps = 0;
  private countInLeft = 0;
  private gameOverLeft = 0;
  private readonly createRun: () => InRun;
  private readonly renderer: RenderPort;
  private readonly starfield: Starfield;
  private readonly presenter: RunPresenter;

  /** `createRun` builds each new run; tests pass a short level script, the game the default. */
  constructor(
    render: RenderPort,
    starfield: Starfield,
    effects: Readonly<EffectSettings>,
    createRun: () => InRun = () => new Run(),
  ) {
    this.renderer = render;
    this.starfield = starfield;
    this.createRun = createRun;
    this.presenter = new RunPresenter(render, effects);
  }

  get scene(): Scene {
    return this.current;
  }

  timeScale(): number {
    return this.current === Scene.Playing ? this.presenter.timeScale() : 1;
  }

  step(dt: number, frame: Readonly<IntentFrame>): void {
    switch (this.current) {
      case Scene.Boot:
        // Nothing to load yet (no assets, no save document). The title takes this step's frame,
        // so a press latched before the first step is not lost.
        this.current = Scene.Title;
        this.stepTitle(frame);
        return;
      case Scene.Title:
        this.stepTitle(frame);
        return;
      case Scene.Playing:
        this.stepPlaying(dt, frame);
        return;
      case Scene.Paused:
        this.stepPaused(frame);
        return;
      case Scene.CountIn:
        this.stepCountIn(dt, frame);
        return;
      case Scene.GameOver:
        this.stepGameOver(frame);
        return;
    }
  }

  // Pause is ignored on the title, as in every scene but play (pause rules).
  private stepTitle(frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    if ((frame.pressed & Button.Confirm) !== 0 || frame.tapRegion !== 'none') {
      this.run = this.createRun(); // InRun entry creates the run.
      this.current = Scene.Playing;
    }
  }

  // Only Pause enters the pause, before the run steps; Back is ignored in play.
  private stepPlaying(dt: number, frame: Readonly<IntentFrame>): void {
    if ((frame.pressed & Button.Pause) !== 0) {
      this.current = Scene.Paused;
      return;
    }
    this.backgroundSteps += 1;
    if (this.run === undefined) return;
    this.run.step(dt, frame);
    if (this.run.outcome() === RunOutcome.GameOver) {
      this.current = Scene.GameOver;
      this.gameOverLeft = GAME_OVER_STEPS;
    }
  }

  // Pause does nothing here: an automatic trigger can only enter the pause, never leave it.
  private stepPaused(frame: Readonly<IntentFrame>): void {
    if ((frame.pressed & (Button.Confirm | Button.Back)) === 0) return;
    this.current = Scene.CountIn;
    this.countInLeft = COUNT_IN_STEPS;
  }

  // Pause wins; the last step hands over to Playing and steps the run, so the first resumed
  // frame interpolates forward from the frozen picture.
  private stepCountIn(dt: number, frame: Readonly<IntentFrame>): void {
    if ((frame.pressed & Button.Pause) !== 0) {
      this.current = Scene.Paused;
      return;
    }
    this.countInLeft -= 1;
    if (this.countInLeft > 0) return;
    this.current = Scene.Playing;
    this.stepPlaying(dt, frame);
  }

  // Confirm, or the game-over time, returns to the title; the run is released there.
  private stepGameOver(frame: Readonly<IntentFrame>): void {
    this.gameOverLeft -= 1;
    if ((frame.pressed & Button.Confirm) === 0 && this.gameOverLeft > 0) return;
    this.run = undefined;
    this.current = Scene.Title;
  }

  render(alpha: number, _wallDtMs: number): void {
    const r = this.renderer;
    const traits = SCENE_TRAITS[this.current];
    // A frozen scene draws its current positions: nothing wobbles between two positions.
    const frameAlpha = traits.frozen ? 1 : alpha;
    r.clear();
    // The bands first: the presenter draws the HUD contents over them.
    r.setRegion('hud');
    this.drawHudBands();
    r.setRegion('field');
    // Frozen scenes draw the starfield at alpha 1 too, so it never steps back at the pause.
    const scroll = traits.scrolls || traits.frozen ? frameAlpha : 0;
    this.starfield.draw(r, (this.backgroundSteps + scroll) * STEP_SECONDS);
    if (traits.drawsRun && this.run !== undefined) {
      this.presenter.draw(this.run.snapshot(), frameAlpha);
    }
    this.drawOverlays();
    r.present();
  }

  private drawOverlays(): void {
    if (this.current === Scene.GameOver) {
      drawVeil(this.renderer);
    } else if (this.current === Scene.Paused) {
      drawVeil(this.renderer);
      drawPauseIcon(this.renderer);
    } else if (this.current === Scene.CountIn) {
      drawCountIn(this.renderer, this.countInLeft);
    }
  }

  // Empty bands until the HUD contents land with scoring and pickups.
  private drawHudBands(): void {
    const r = this.renderer;
    const rightBandX = FIELD_X + FIELD_WIDTH;
    r.drawRect(0, 0, HUD_BAND_WIDTH, SCREEN_HEIGHT, Palette.hudBand);
    r.drawRect(rightBandX, 0, HUD_BAND_WIDTH, SCREEN_HEIGHT, Palette.hudBand);
    r.drawRect(FIELD_X - 1, 0, 1, SCREEN_HEIGHT, Palette.hudEdge);
    r.drawRect(rightBandX, 0, 1, SCREEN_HEIGHT, Palette.hudEdge);
  }
}
