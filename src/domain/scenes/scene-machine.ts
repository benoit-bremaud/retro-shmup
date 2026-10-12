import { RunOutcome } from '../game/run';
import type { RunView, Simulation } from '../game/run';
import { ResultsTuning, SceneTuning, STEP_SECONDS, toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { RenderPort } from '../ports/render-port';
import { message } from '../i18n/messages';
import type { Language } from '../i18n/messages';
import { drawHudFrame, drawPauseButton } from '../presentation/hud';
import { isPauseTap } from '../presentation/hud-layout';
import {
  drawBanner,
  drawCountIn,
  drawPauseIcon,
  drawVeil,
  drawWarning,
} from '../presentation/overlays';
import { RunPresenter } from '../presentation/run-presenter';
import type { EffectSettings } from '../presentation/run-presenter';
import type { Starfield } from '../presentation/starfield';

/** The scenes built so far (meta/05-state-scenes, build order). */
export const Scene = {
  Boot: 'BOOT',
  Title: 'TITLE',
  Playing: 'PLAYING',
  Paused: 'PAUSED',
  CountIn: 'COUNT_IN',
  GameOver: 'GAME_OVER',
  Results: 'RESULTS',
} as const;
export type Scene = (typeof Scene)[keyof typeof Scene];

/** What differs between scenes for drawing, read by `render`. */
interface SceneTraits {
  /** The run does not step and the frame draws at alpha 1. */
  readonly frozen: boolean;
  /** The background clock advances. */
  readonly scrolls: boolean;
  readonly drawsRun: boolean;
  /** The touch pause button is drawn and hit-tested (GDD v0.7 §4.2). */
  readonly pauseButton: boolean;
}

const SCENE_TRAITS: Readonly<Record<Scene, SceneTraits>> = {
  [Scene.Boot]: { frozen: false, scrolls: false, drawsRun: false, pauseButton: false },
  [Scene.Title]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.Playing]: { frozen: false, scrolls: true, drawsRun: true, pauseButton: true },
  [Scene.Paused]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: true },
  [Scene.CountIn]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: true },
  // Arcade style: the run plays on without the ship behind GAME OVER (GDD v0.6 §4.4).
  [Scene.GameOver]: { frozen: false, scrolls: true, drawsRun: true, pauseButton: false },
  // The run stands still behind the banner while the starfield keeps moving (05-state-scenes).
  [Scene.Results]: { frozen: true, scrolls: true, drawsRun: true, pauseButton: false },
};

const COUNT_IN_STEPS = toSteps(SceneTuning.countInSeconds);
const GAME_OVER_STEPS = toSteps(SceneTuning.gameOverSeconds);
const LOCK_STEPS = toSteps(SceneTuning.gameOverLockSeconds);
const LEVEL_CLEAR_STEPS = toSteps(ResultsTuning.levelClearSeconds);

function isConfirmOrTap(frame: Readonly<IntentFrame>): boolean {
  return (frame.pressed & Button.Confirm) !== 0 || frame.tapRegion !== 'none';
}

/** What the scene machine holds of a run: it steps it and reads it, nothing more. */
type InRun = Simulation & RunView;

/**
 * The screens and their transitions (meta/05-state-scenes): Boot → Title → InRun { Playing ⇄
 * Paused ⇄ Count-in } → Game over → Title, or → Results → Title when the run is cleared. Game over
 * keeps stepping the run without the ship; Results holds it still; the run is released at the title. It satisfies the frame loop's `FrameTarget` structurally, so the
 * domain never imports the loop. It owns the background clock, so the starfield scrolls on the
 * title and in play without a jump at the start, and freezes with the run.
 */
export class SceneMachine {
  private current: Scene = Scene.Boot;
  private run: InRun | undefined;
  private backgroundSteps = 0;
  private countInLeft = 0;
  private gameOverLeft = 0;
  private resultsLeft = 0;
  /**
   * Steps left during which Confirm and taps are ignored: set on entering Game over and on the
   * title reached from it, so hammering never skips GAME OVER nor starts a new run (GDD v0.7 §4.4).
   */
  private lockLeft = 0;
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

  /** `createRun` builds each new run; tests pass a short level script, the game a seeded one. */
  constructor(
    render: RenderPort,
    starfield: Starfield,
    effects: Readonly<EffectSettings>,
    createRun: () => InRun,
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
      case Scene.Results:
        this.stepResults();
        return;
    }
  }

  // Pause is ignored on the title, as in every scene but play (pause rules); any tap starts.
  private stepTitle(frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    if (this.locked()) return;
    if (isConfirmOrTap(frame)) {
      const run = this.createRun(); // InRun entry creates the run and its presenter.
      this.run = run;
      this.presenter = new RunPresenter(this.renderer, this.effects, run.events());
      this.current = Scene.Playing;
    }
  }

  // Pause or the pause button enters the pause, before the run steps; Back is ignored in play.
  private stepPlaying(dt: number, frame: Readonly<IntentFrame>): void {
    if (this.pauses(frame)) {
      this.current = Scene.Paused;
      return;
    }
    this.backgroundSteps += 1;
    if (this.run === undefined) return;
    this.run.step(dt, frame);
    if (this.run.outcome() === RunOutcome.GameOver) {
      this.current = Scene.GameOver;
      this.gameOverLeft = GAME_OVER_STEPS;
      this.lockLeft = LOCK_STEPS;
    } else if (this.run.outcome() === RunOutcome.RunCleared) {
      // `LevelCleared` (a list of several levels) is not handled: the slice has one level, and the
      // next-level flow belongs to the screens brick (ADR-0022 decision 9).
      this.current = Scene.Results;
      this.resultsLeft = LEVEL_CLEAR_STEPS;
    }
  }

  // Pause does nothing here: an automatic trigger can only enter the pause, never leave it. Any
  // tap resumes until the pause menu of the screens brick (interim deviation, tap resume).
  private stepPaused(frame: Readonly<IntentFrame>): void {
    if ((frame.pressed & (Button.Confirm | Button.Back)) === 0 && frame.tapRegion === 'none')
      return;
    this.current = Scene.CountIn;
    this.countInLeft = COUNT_IN_STEPS;
  }

  // Pause wins; the last step hands over to Playing and steps the run, so the first resumed
  // frame interpolates forward from the frozen picture.
  private stepCountIn(dt: number, frame: Readonly<IntentFrame>): void {
    if (this.pauses(frame)) {
      this.current = Scene.Paused;
      return;
    }
    this.countInLeft -= 1;
    if (this.countInLeft > 0) return;
    this.current = Scene.Playing;
    this.stepPlaying(dt, frame);
  }

  // The run plays on without the ship; Confirm or a tap after the lock, or the game-over time,
  // returns to the title, where the run is released and the same lock applies.
  private stepGameOver(dt: number, frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    this.run?.step(dt, frame);
    this.gameOverLeft -= 1;
    const confirmed = !this.locked() && isConfirmOrTap(frame);
    if (!confirmed && this.gameOverLeft > 0) return;
    this.run = undefined;
    this.presenter = undefined;
    this.current = Scene.Title;
    this.lockLeft = LOCK_STEPS;
  }

  // Interim (F-2a, before the tally of F-3): the banner stands for 3 s, input ignored, then the
  // title, where the same lock as after Game over applies.
  private stepResults(): void {
    this.backgroundSteps += 1;
    this.resultsLeft -= 1;
    if (this.resultsLeft > 0) return;
    this.run = undefined;
    this.presenter = undefined;
    this.current = Scene.Title;
    this.lockLeft = LOCK_STEPS;
  }

  /** Consumes one locked step; true while Confirm and taps are still ignored. */
  private locked(): boolean {
    if (this.lockLeft === 0) return false;
    this.lockLeft -= 1;
    return true;
  }

  /** `Pause`, or a tap on the pause button of the current screen (ADR-0018 decision 1). */
  private pauses(frame: Readonly<IntentFrame>): boolean {
    if ((frame.pressed & Button.Pause) !== 0) return true;
    return isPauseTap(frame.tapRegion, frame.tapX, frame.tapY, this.renderer.layout());
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
    // The HUD background first: the presenter draws the HUD contents over it.
    drawHudFrame(r);
    r.setRegion('field');
    // The bomb's shake moves the whole field, starfield included, and never in a frozen frame.
    if (!traits.frozen && traits.drawsRun && this.presenter !== undefined) {
      this.presenter.applyShake();
    } else {
      r.setCameraOffset(0, 0);
    }
    // Frozen scenes draw the starfield at alpha 1 too, so it never steps back at the pause.
    const scroll = traits.scrolls || traits.frozen ? frameAlpha : 0;
    this.starfield.draw(r, (this.backgroundSteps + scroll) * STEP_SECONDS);
    if (traits.drawsRun && this.run !== undefined && this.presenter !== undefined) {
      const snapshot = this.run.snapshot();
      this.presenter.draw(snapshot, frameAlpha, effectMs);
      // The WARNING banner reads the boss state, so the pause freezes it; it shows in Playing only,
      // so it never sits under GAME OVER, the pause icon or the count-in digit, which share its centre.
      if (this.current === Scene.Playing) {
        drawWarning(r, snapshot.boss, this.effects.blink, this.language);
      }
    }
    if (traits.pauseButton) drawPauseButton(r);
    this.drawOverlays();
    r.present();
  }

  private drawOverlays(): void {
    if (this.current === Scene.GameOver) {
      drawVeil(this.renderer);
      drawBanner(this.renderer, message('gameOver', this.language));
    } else if (this.current === Scene.Results) {
      drawVeil(this.renderer);
      drawBanner(this.renderer, message('levelClear', this.language));
    } else if (this.current === Scene.Paused) {
      drawVeil(this.renderer);
      drawPauseIcon(this.renderer);
    } else if (this.current === Scene.CountIn) {
      drawCountIn(this.renderer, this.countInLeft);
    }
  }
}
