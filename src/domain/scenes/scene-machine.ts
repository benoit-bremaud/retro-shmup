import { RunOutcome } from '../game/run';
import type { RunView, Simulation } from '../game/run';
import { ResultsTuning, SceneTuning, STEP_SECONDS, toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { RenderPort } from '../ports/render-port';
import { message } from '../i18n/messages';
import type { Language, MessageKey } from '../i18n/messages';
import { drawHudFrame, drawPauseButton } from '../presentation/hud';
import { isPauseTap } from '../presentation/hud-layout';
import {
  drawBanner,
  drawCountIn,
  drawMenuScreen,
  drawVeil,
  drawWarning,
} from '../presentation/overlays';
import { drawResults, formatTallyValues } from '../presentation/results';
import { RunPresenter } from '../presentation/run-presenter';
import type { EffectSettings } from '../options';
import type { Starfield } from '../presentation/starfield';
import type { MenuScreen } from '../presentation/menu-layout';
import { Menu } from './menu';

/** The scenes built so far (meta/05-state-scenes, build order). */
export const Scene = {
  Boot: 'BOOT',
  Title: 'TITLE',
  Playing: 'PLAYING',
  Paused: 'PAUSED',
  CountIn: 'COUNT_IN',
  GameOver: 'GAME_OVER',
  Results: 'RESULTS',
  ConfirmQuit: 'CONFIRM_QUIT',
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
  // The run stands still behind the tally while the starfield keeps moving (05-state-scenes).
  [Scene.Results]: { frozen: true, scrolls: true, drawsRun: true, pauseButton: false },
  [Scene.ConfirmQuit]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
};

const COUNT_IN_STEPS = toSteps(SceneTuning.countInSeconds);
const GAME_OVER_STEPS = toSteps(SceneTuning.gameOverSeconds);
const LOCK_STEPS = toSteps(SceneTuning.gameOverLockSeconds);
const RESULTS_LOCK_STEPS = toSteps(ResultsTuning.lockSeconds);
const RESULTS_STEPS = toSteps(ResultsTuning.autoSeconds);

function isConfirmOrTap(frame: Readonly<IntentFrame>): boolean {
  return (frame.pressed & Button.Confirm) !== 0 || frame.tapRegion !== 'none';
}

/** A menu scene: the presentation's screen description, holding the scene's live menu. */
interface MenuScene extends MenuScreen {
  readonly menu: Menu<MessageKey>;
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
  /** Steps since `Results` was entered (0 on the entering step): the lines shown and the 8 s exit. */
  private resultsSteps = 0;
  /** The Results values, formatted once on entry so no string is built per frame. */
  private resultsValues: readonly string[] = [];
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
  /** Every step since Boot: the menus' clock (the re-press guard), never wall time. */
  private steps = 0;
  /** The pause menu and its quit confirmation (GDD v0.13 §9.1), built once. */
  private readonly pauseMenu = new Menu(['resume', 'quit'] as const);
  private readonly quitMenu = new Menu(['no', 'yes'] as const);
  /**
   * Every menu scene: its menu and header. Drawing and opening read this one table, so a new menu
   * screen is one entry here plus its step method.
   */
  private readonly menuScreens: Partial<Record<Scene, MenuScene>> = {
    [Scene.Paused]: { menu: this.pauseMenu, header: 'pause', headerFont: 'title' },
    [Scene.ConfirmQuit]: { menu: this.quitMenu, header: 'quitQuestion', headerFont: 'menu' },
  };

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
    this.steps += 1;
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
        this.stepResults(frame);
        return;
      case Scene.ConfirmQuit:
        this.stepConfirmQuit(frame);
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
      this.openMenu(Scene.Paused);
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
      this.resultsSteps = 0;
      this.resultsValues = formatTallyValues(this.run.tally());
      this.lockLeft = RESULTS_LOCK_STEPS;
    }
  }

  /** Enters a menu scene and opens its menu: the one place a menu is reset (first row, guard). */
  private openMenu(scene: Scene): void {
    this.current = scene;
    this.menuScreens[scene]?.menu.reset(this.steps);
  }

  // Pause does nothing here: an automatic trigger can only enter the pause, never leave it. Back
  // and the pause button resume like the Resume row; Quit asks first (GDD v0.13 §9.1).
  private stepPaused(frame: Readonly<IntentFrame>): void {
    const row = this.pauseMenu.step(frame, this.steps);
    if (row === 'quit') {
      this.openMenu(Scene.ConfirmQuit);
    } else if (row === 'resume' || this.pauseButtonTapped(frame) || this.backed(frame)) {
      this.current = Scene.CountIn;
      this.countInLeft = COUNT_IN_STEPS;
    }
  }

  // No is first, so a hurried Confirm never loses the run; Back returns to the pause, Pause is
  // ignored. Yes discards the run: no name entry, and the title is locked like after Game over.
  private stepConfirmQuit(frame: Readonly<IntentFrame>): void {
    const row = this.quitMenu.step(frame, this.steps);
    if (row === 'yes') {
      this.toTitle();
    } else if (row === 'no' || this.backed(frame)) {
      this.openMenu(Scene.Paused);
    }
  }

  // Pause wins; the last step hands over to Playing and steps the run, so the first resumed
  // frame interpolates forward from the frozen picture.
  private stepCountIn(dt: number, frame: Readonly<IntentFrame>): void {
    if (this.pauses(frame)) {
      this.openMenu(Scene.Paused);
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
    this.toTitle();
  }

  // Confirm or a tap after the 1 s lock, or the 8 s timer, returns to the title (the slice end,
  // interim until the Ending), where the same lock as after Game over applies. Pause is ignored:
  // the slice's Results lead to the title, never back to play (interim deviation, 05-state-scenes).
  private stepResults(frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    this.resultsSteps += 1;
    const confirmed = !this.locked() && isConfirmOrTap(frame);
    if (!confirmed && this.resultsSteps < RESULTS_STEPS) return;
    this.resultsValues = [];
    this.toTitle();
  }

  /** The run is released at the title, locked for 1 s so hammering never starts a new run. */
  private toTitle(): void {
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
    return (frame.pressed & Button.Pause) !== 0 || this.pauseButtonTapped(frame);
  }

  private pauseButtonTapped(frame: Readonly<IntentFrame>): boolean {
    return isPauseTap(frame.tapRegion, frame.tapX, frame.tapY, this.renderer.layout());
  }

  private backed(frame: Readonly<IntentFrame>): boolean {
    return (frame.pressed & Button.Back) !== 0;
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
    const menuScreen = this.menuScreens[this.current];
    if (menuScreen !== undefined) {
      drawMenuScreen(this.renderer, menuScreen, this.language);
    } else if (this.current === Scene.GameOver) {
      drawVeil(this.renderer);
      drawBanner(this.renderer, message('gameOver', this.language));
    } else if (this.current === Scene.Results) {
      drawResults(this.renderer, this.resultsValues, this.resultsSteps, this.language);
    } else if (this.current === Scene.CountIn) {
      drawCountIn(this.renderer, this.countInLeft);
    }
  }
}
