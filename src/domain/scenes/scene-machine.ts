import { Run, RunOutcome } from '../game/run';
import type { RunView, Simulation } from '../game/run';
import { SceneTuning, STEP_SECONDS, toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { RenderPort } from '../ports/render-port';
import { message } from '../i18n/messages';
import type { Language } from '../i18n/messages';
import { drawBanner, drawCountIn, drawPauseIcon, drawVeil } from '../presentation/overlays';
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
  // Arcade style: the run plays on without the ship behind GAME OVER (GDD v0.6 §4.4).
  [Scene.GameOver]: { frozen: false, scrolls: true, drawsRun: true },
};

const COUNT_IN_STEPS = toSteps(SceneTuning.countInSeconds);
const GAME_OVER_STEPS = toSteps(SceneTuning.gameOverSeconds);

/** What the scene machine holds of a run: it steps it and reads it, nothing more. */
type InRun = Simulation & RunView;

/**
 * The screens and their transitions (meta/05-state-scenes): Boot → Title → InRun { Playing ⇄
 * Paused ⇄ Count-in } → Game over → Title. Game over keeps stepping the run without the ship; the run is released at the title. It
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
  /** English until the options screen chooses (GDD §9.6). */
  private readonly language: Language = 'en';
  private readonly createRun: () => InRun;
  private readonly renderer: RenderPort;
  private readonly starfield: Starfield;
  private readonly effects: Readonly<EffectSettings>;
  /** Built with each run, so no effect or listener outlives its run (ADR-0010). */
  private presenter: RunPresenter | undefined;
  /** A frozen step ran since the last render: that frame ages no effect (count-in handoff). */
  private frozenStepSinceRender = false;

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
    this.effects = effects;
  }

  get scene(): Scene {
    return this.current;
  }

  timeScale(): number {
    if (this.current !== Scene.Playing || this.presenter === undefined) return 1;
    return this.presenter.timeScale();
  }

  step(dt: number, frame: Readonly<IntentFrame>): void {
    if (SCENE_TRAITS[this.current].frozen) this.frozenStepSinceRender = true;
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
        this.stepGameOver(dt, frame);
        return;
    }
  }

  // Pause is ignored on the title, as in every scene but play (pause rules).
  private stepTitle(frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    if ((frame.pressed & Button.Confirm) !== 0 || frame.tapRegion !== 'none') {
      const run = this.createRun(); // InRun entry creates the run and its presenter.
      this.run = run;
      this.presenter = new RunPresenter(this.renderer, this.effects, run.events());
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

  // The run plays on without the ship; Confirm, or the game-over time, returns to the title,
  // where the run is released.
  private stepGameOver(dt: number, frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    this.run?.step(dt, frame);
    this.gameOverLeft -= 1;
    if ((frame.pressed & Button.Confirm) === 0 && this.gameOverLeft > 0) return;
    this.run = undefined;
    this.presenter = undefined;
    this.current = Scene.Title;
  }

  render(alpha: number, wallDtMs: number): void {
    const r = this.renderer;
    const traits = SCENE_TRAITS[this.current];
    // A frozen scene draws its current positions: nothing wobbles between two positions.
    const frameAlpha = traits.frozen ? 1 : alpha;
    // Effects never age in a frozen frame, nor in one that ran a frozen step (the handoff).
    const effectMs = traits.frozen || this.frozenStepSinceRender ? 0 : wallDtMs;
    this.frozenStepSinceRender = false;
    r.clear();
    // The bands first: the presenter draws the HUD contents over them.
    r.setRegion('hud');
    this.drawHudBands();
    r.setRegion('field');
    // Frozen scenes draw the starfield at alpha 1 too, so it never steps back at the pause.
    const scroll = traits.scrolls || traits.frozen ? frameAlpha : 0;
    this.starfield.draw(r, (this.backgroundSteps + scroll) * STEP_SECONDS);
    if (traits.drawsRun && this.run !== undefined && this.presenter !== undefined) {
      this.presenter.draw(this.run.snapshot(), frameAlpha, effectMs);
    }
    this.drawOverlays();
    r.present();
  }

  private drawOverlays(): void {
    if (this.current === Scene.GameOver) {
      drawVeil(this.renderer);
      drawBanner(this.renderer, message('gameOver', this.language));
    } else if (this.current === Scene.Paused) {
      drawVeil(this.renderer);
      drawPauseIcon(this.renderer);
    } else if (this.current === Scene.CountIn) {
      drawCountIn(this.renderer, this.countInLeft);
    }
  }

  // The HUD bands; the presenter draws their contents over them.
  private drawHudBands(): void {
    const r = this.renderer;
    const rightBandX = FIELD_X + FIELD_WIDTH;
    r.drawRect(0, 0, HUD_BAND_WIDTH, SCREEN_HEIGHT, Palette.hudBand);
    r.drawRect(rightBandX, 0, HUD_BAND_WIDTH, SCREEN_HEIGHT, Palette.hudBand);
    r.drawRect(FIELD_X - 1, 0, 1, SCREEN_HEIGHT, Palette.hudEdge);
    r.drawRect(rightBandX, 0, 1, SCREEN_HEIGHT, Palette.hudEdge);
  }
}
