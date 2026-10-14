import { RunOutcome } from '../game/run';
import type { RunView, Simulation } from '../game/run';
import { ResultsTuning, SceneTuning, STEP_SECONDS, toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { RenderPort } from '../ports/render-port';
import { message } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { drawHudFrame, drawPauseButton } from '../presentation/hud';
import { isPauseTap } from '../presentation/hud-layout';
import {
  drawBanner,
  drawControlsScreen,
  drawCountIn,
  drawMenuScreen,
  drawVeil,
  drawWarning,
} from '../presentation/overlays';
import { drawResults, formatTallyValues } from '../presentation/results';
import { RunPresenter } from '../presentation/run-presenter';
import { EFFECT_ROWS, LiveOptions } from '../options';
import type { Options } from '../options';
import type { Starfield } from '../presentation/starfield';
import type { MenuScreen } from '../presentation/menu-layout';
import { ControlsScreen } from './controls-screen';
import { Menu } from './menu';
import { NO_HOST } from './scene-host';
import type { SceneHost } from './scene-host';
import type { OpenableMenu } from './menu';

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
  /** Options and Visual effects, from the title and from the pause (two menus, four scenes). */
  TitleOptions: 'TITLE_OPTIONS',
  TitleEffects: 'TITLE_EFFECTS',
  PauseOptions: 'PAUSE_OPTIONS',
  PauseEffects: 'PAUSE_EFFECTS',
  /** The controls screen and its restore confirmation, from the title and from the pause (G1b). */
  TitleControls: 'TITLE_CONTROLS',
  TitleRestore: 'TITLE_RESTORE',
  PauseControls: 'PAUSE_CONTROLS',
  PauseRestore: 'PAUSE_RESTORE',
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
  [Scene.TitleOptions]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.TitleEffects]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.PauseOptions]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
  [Scene.PauseEffects]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
  [Scene.TitleControls]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.TitleRestore]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.PauseControls]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
  [Scene.PauseRestore]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
};

/** Where each options scene's Back and sub-screen lead (meta/05-state-scenes). */
const OPTIONS_ROUTES = {
  [Scene.TitleOptions]: {
    parent: Scene.Title,
    effects: Scene.TitleEffects,
    controls: Scene.TitleControls,
  },
  [Scene.PauseOptions]: {
    parent: Scene.Paused,
    effects: Scene.PauseEffects,
    controls: Scene.PauseControls,
  },
} as const;
const CONTROLS_ROUTES = {
  [Scene.TitleControls]: { parent: Scene.TitleOptions, restore: Scene.TitleRestore },
  [Scene.PauseControls]: { parent: Scene.PauseOptions, restore: Scene.PauseRestore },
} as const;
const RESTORE_PARENT = {
  [Scene.TitleRestore]: Scene.TitleControls,
  [Scene.PauseRestore]: Scene.PauseControls,
} as const;

/** The options rows; *Controls* is hidden when the last device used is touch (GDD v0.15 §4.2). */
type OptionsRow = 'visualEffects' | 'controls' | 'autofire' | 'language' | 'fullscreen' | 'back';
const EFFECTS_PARENT = {
  [Scene.TitleEffects]: Scene.TitleOptions,
  [Scene.PauseEffects]: Scene.PauseOptions,
} as const;

const COUNT_IN_STEPS = toSteps(SceneTuning.countInSeconds);
const GAME_OVER_STEPS = toSteps(SceneTuning.gameOverSeconds);
const LOCK_STEPS = toSteps(SceneTuning.gameOverLockSeconds);
const RESULTS_LOCK_STEPS = toSteps(ResultsTuning.lockSeconds);
const RESULTS_STEPS = toSteps(ResultsTuning.autoSeconds);

function isConfirmOrTap(frame: Readonly<IntentFrame>): boolean {
  return (frame.pressed & Button.Confirm) !== 0 || frame.tapRegion !== 'none';
}

/** A menu scene: the presentation's screen description, holding a menu the scene can open. */
interface MenuScene extends MenuScreen {
  readonly menu: OpenableMenu;
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
  private readonly options: LiveOptions;
  private readonly host: SceneHost;
  private readonly createRun: () => InRun;
  private readonly renderer: RenderPort;
  private readonly starfield: Starfield;
  /** Built with each run, so no effect or listener outlives its run (ADR-0010). */
  private presenter: RunPresenter | undefined;
  /** A frozen step ran since the last render: that frame ages no effect (count-in handoff). */
  private frozenStepSinceRender = false;
  /** Every step since Boot: the menus' clock (the re-press guard), never wall time. */
  private steps = 0;
  /** The five menus (GDD v0.13 and v0.14 §9.1), built once. */
  private readonly titleMenu = new Menu(['play', 'options'] as const);
  private readonly pauseMenu = new Menu(['resume', 'options', 'quit'] as const);
  private readonly quitMenu = new Menu(['no', 'yes'] as const);
  // Called only after the constructor has set `options` (field initialisers run first).
  // Left and right flip exactly the rows that show a value (GDD v0.14 §9.1).
  private readonly hasValue = (row: MessageKey): boolean => this.options.value(row) !== undefined;
  /** The value each options row shows, read at each draw; built once. */
  private readonly value = (row: MessageKey): MessageKey | undefined => this.options.value(row);
  private readonly fullOptionsMenu = new Menu<OptionsRow>(
    ['visualEffects', 'controls', 'autofire', 'language', 'fullscreen', 'back'],
    this.hasValue,
  );
  private readonly touchOptionsMenu = new Menu<OptionsRow>(
    ['visualEffects', 'autofire', 'language', 'fullscreen', 'back'],
    this.hasValue,
  );
  /** The options menu in use, chosen each time the options open. */
  private optionsMenu = this.fullOptionsMenu;
  private readonly restoreMenu = new Menu(['no', 'yes'] as const);
  /** The device of the last input, whatever it was: touch hides the *Controls* row. */
  private lastDevice: IntentFrame['device'] = 'keyboard';
  private readonly effectsMenu = new Menu(
    ['allOn', 'allOff', ...EFFECT_ROWS, 'back'] as const,
    this.hasValue,
  );
  /**
   * Every menu scene: its menu and header. Drawing and opening read this one table, so a new menu
   * screen is one entry here plus its step method.
   */
  private readonly menuScreens: Partial<Record<Scene, MenuScene>> = {
    [Scene.Title]: { menu: this.titleMenu },
    [Scene.Paused]: { menu: this.pauseMenu, header: { key: 'pause', font: 'title' } },
    [Scene.ConfirmQuit]: { menu: this.quitMenu, header: { key: 'quitQuestion', font: 'menu' } },
    [Scene.TitleOptions]: this.optionsScreen(),
    [Scene.PauseOptions]: this.optionsScreen(),
    [Scene.TitleEffects]: this.effectsScreen(),
    [Scene.PauseEffects]: this.effectsScreen(),
    [Scene.TitleRestore]: this.restoreScreen(),
    [Scene.PauseRestore]: this.restoreScreen(),
  };
  private readonly controls: ControlsScreen;

  /**
   * `options` are the saved ones, copied into the live options; `createRun` builds each new run
   * (tests pass a short level script, the game a seeded one); `host` hears every change.
   */
  constructor(
    render: RenderPort,
    starfield: Starfield,
    options: Readonly<Options>,
    createRun: () => InRun,
    host: SceneHost = NO_HOST,
  ) {
    this.renderer = render;
    this.starfield = starfield;
    this.createRun = createRun;
    this.host = host;
    this.options = new LiveOptions(options);
    this.controls = new ControlsScreen(this.options, host);
  }

  private optionsScreen(): MenuScene {
    return { menu: this.optionsMenu, header: { key: 'options', font: 'title' }, value: this.value };
  }

  private restoreScreen(): MenuScene {
    return { menu: this.restoreMenu, header: { key: 'restoreDefaults', font: 'menu' } };
  }

  private effectsScreen(): MenuScene {
    return {
      menu: this.effectsMenu,
      header: { key: 'visualEffects', font: 'menu' },
      value: this.value,
    };
  }

  get scene(): Scene {
    return this.current;
  }

  timeScale(): number {
    if (this.current !== Scene.Playing || this.presenter === undefined) return 1;
    return this.presenter.timeScale();
  }

  step(dt: number, frame: Readonly<IntentFrame>): void {
    const traits = SCENE_TRAITS[this.current];
    if (traits.frozen) this.frozenStepSinceRender = true;
    // The title and its menus scroll the background; the scenes with a run count it themselves.
    if (traits.scrolls && !traits.drawsRun) this.backgroundSteps += 1;
    this.steps += 1;
    this.lastDevice = frame.device;
    switch (this.current) {
      case Scene.Boot:
        // Nothing to load yet (no assets, no save document). The title takes this step's frame,
        // so a press latched before the first step is not lost.
        this.openMenu(Scene.Title, frame);
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
      case Scene.TitleOptions:
      case Scene.PauseOptions:
        this.stepOptions(frame, this.current);
        return;
      case Scene.TitleEffects:
      case Scene.PauseEffects:
        this.stepEffects(frame, this.current);
        return;
      case Scene.TitleControls:
      case Scene.PauseControls:
        this.stepControls(frame, this.current);
        return;
      case Scene.TitleRestore:
      case Scene.PauseRestore:
        this.stepRestore(frame, this.current);
        return;
    }
  }

  // Pause is ignored on the title, as in every scene but play (pause rules). The lock ignores
  // the whole menu; Play starts a run, Options opens the options (GDD v0.14 §9.1).
  private stepTitle(frame: Readonly<IntentFrame>): void {
    if (this.locked()) {
      // The lock ignores the whole menu: what is held now counts as held when it ends.
      this.titleMenu.ignore(frame);
      return;
    }
    const row = this.titleMenu.step(frame, this.steps);
    if (row === 'options') {
      this.openMenu(Scene.TitleOptions, frame);
    } else if (row === 'play') {
      const run = this.createRun(); // InRun entry creates the run and its presenter.
      this.run = run;
      this.presenter = new RunPresenter(this.renderer, this.options.effects, run.events());
      this.current = Scene.Playing;
      this.host.releaseMovement();
    }
  }

  // Each change applies at once and reaches the host; Back and the Back row return to the
  // parent, Visual effects opens its sub-screen (GDD v0.14 §9.1, §9.3).
  private stepOptions(frame: Readonly<IntentFrame>, scene: keyof typeof OPTIONS_ROUTES): void {
    const row = this.optionsMenu.step(frame, this.steps);
    if (this.backTo(row, frame, OPTIONS_ROUTES[scene].parent)) return;
    if (row === 'visualEffects') this.openMenu(OPTIONS_ROUTES[scene].effects, frame);
    else if (row === 'controls') this.openControls(OPTIONS_ROUTES[scene].controls, frame);
    else this.change(row);
  }

  private stepEffects(frame: Readonly<IntentFrame>, scene: keyof typeof EFFECTS_PARENT): void {
    const row = this.effectsMenu.step(frame, this.steps);
    if (this.backTo(row, frame, EFFECTS_PARENT[scene])) return;
    this.change(row);
  }

  // The controls screen does its own work; it hands back only its two exits (GDD v0.15 §4.2).
  private stepControls(frame: Readonly<IntentFrame>, scene: keyof typeof CONTROLS_ROUTES): void {
    const exit = this.controls.step(frame, this.steps);
    if (exit === 'back') this.openMenu(CONTROLS_ROUTES[scene].parent, frame);
    else if (exit === 'restore') this.openMenu(CONTROLS_ROUTES[scene].restore, frame);
  }

  // No is first, like Quit; Yes restores the device edited only, then back to the controls.
  private stepRestore(frame: Readonly<IntentFrame>, scene: keyof typeof RESTORE_PARENT): void {
    const row = this.restoreMenu.step(frame, this.steps);
    if (row === 'yes') this.controls.restoreDefaults();
    if (row !== undefined || this.backed(frame)) this.openControls(RESTORE_PARENT[scene], frame);
  }

  private openControls(scene: Scene, frame: Readonly<IntentFrame>): void {
    this.current = scene;
    this.controls.open(this.steps, frame);
  }

  /** The Back row or `back` opens `parent`; returns whether it did. */
  private backTo(
    row: MessageKey | undefined,
    frame: Readonly<IntentFrame>,
    parent: Scene,
  ): boolean {
    if (row !== 'back' && (row !== undefined || !this.backed(frame))) return false;
    this.openMenu(parent, frame);
    return true;
  }

  private change(row: MessageKey | undefined): void {
    if (row !== undefined && this.options.apply(row)) this.host.optionsChanged(this.options);
  }

  // Pause or the pause button enters the pause, before the run steps; Back is ignored in play.
  private stepPlaying(dt: number, frame: Readonly<IntentFrame>): void {
    if (this.pauses(frame)) {
      this.openMenu(Scene.Paused, frame);
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
  private openMenu(scene: Scene, frame: Readonly<IntentFrame>): void {
    if (scene === Scene.TitleOptions || scene === Scene.PauseOptions) this.chooseOptionsMenu(scene);
    this.controls.leave();
    this.current = scene;
    this.menuScreens[scene]?.menu.reset(this.steps, frame);
  }

  // Pause does nothing here: an automatic trigger can only enter the pause, never leave it. Back
  // and the pause button resume like the Resume row; Quit asks first (GDD v0.13 §9.1).
  private stepPaused(frame: Readonly<IntentFrame>): void {
    const row = this.pauseMenu.step(frame, this.steps);
    if (row === 'quit') {
      this.openMenu(Scene.ConfirmQuit, frame);
    } else if (row === 'options') {
      this.openMenu(Scene.PauseOptions, frame);
    } else if (row === 'resume' || this.pauseButtonTapped(frame) || this.backed(frame)) {
      this.current = Scene.CountIn;
      this.countInLeft = COUNT_IN_STEPS;
      this.host.releaseMovement();
    }
  }

  // No is first, so a hurried Confirm never loses the run; Back returns to the pause, Pause is
  // ignored. Yes discards the run: no name entry, and the title is locked like after Game over.
  private stepConfirmQuit(frame: Readonly<IntentFrame>): void {
    const row = this.quitMenu.step(frame, this.steps);
    if (row === 'yes') {
      this.toTitle(frame);
    } else if (row === 'no' || this.backed(frame)) {
      this.openMenu(Scene.Paused, frame);
    }
  }

  // Pause wins; the last step hands over to Playing and steps the run, so the first resumed
  // frame interpolates forward from the frozen picture.
  private stepCountIn(dt: number, frame: Readonly<IntentFrame>): void {
    if (this.pauses(frame)) {
      this.openMenu(Scene.Paused, frame);
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
    this.toTitle(frame);
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
    this.toTitle(frame);
  }

  /** The run is released at the title, locked for 1 s so hammering never starts a new run. */
  private toTitle(frame: Readonly<IntentFrame>): void {
    this.run = undefined;
    this.presenter = undefined;
    this.openMenu(Scene.Title, frame);
    this.lockLeft = LOCK_STEPS;
  }

  /** The options with *Controls*, unless the last device used is touch (GDD v0.15 §4.2). */
  private chooseOptionsMenu(scene: typeof Scene.TitleOptions | typeof Scene.PauseOptions): void {
    this.optionsMenu = this.lastDevice === 'touch' ? this.touchOptionsMenu : this.fullOptionsMenu;
    this.menuScreens[scene] = this.optionsScreen();
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
        drawWarning(r, snapshot.boss, this.options.effects.blink, this.options.language);
      }
    }
    if (traits.pauseButton) drawPauseButton(r);
    this.drawOverlays();
    r.present();
  }

  private drawOverlays(): void {
    const menuScreen = this.menuScreens[this.current];
    if (this.current === Scene.TitleControls || this.current === Scene.PauseControls) {
      drawControlsScreen(this.renderer, this.controls, this.options.language);
    } else if (menuScreen !== undefined) {
      drawMenuScreen(this.renderer, menuScreen, this.options.language);
    } else if (this.current === Scene.GameOver) {
      drawVeil(this.renderer);
      drawBanner(this.renderer, message('gameOver', this.options.language));
    } else if (this.current === Scene.Results) {
      drawResults(this.renderer, this.resultsValues, this.resultsSteps, this.options.language);
    } else if (this.current === Scene.CountIn) {
      drawCountIn(this.renderer, this.countInLeft);
    }
  }
}
