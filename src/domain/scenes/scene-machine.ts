import { runTrack, Track } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { volumeGain } from '../audio/volume';
import { SILENT_AUDIO } from '../ports/audio-port';
import type { AudioPort } from '../ports/audio-port';
import { RunOutcome } from '../game/run';
import type { RunView, Simulation } from '../game/run';
import { ResultsTuning, SceneTuning, STEP_SECONDS, toSteps } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { LinkOutcome } from '../ports/link-port';
import type { RenderPort } from '../ports/render-port';
import { message } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { drawHudFrame, drawPauseButton } from '../presentation/hud';
import { isPauseTap } from '../presentation/hud-layout';
import {
  drawBanner,
  drawControlsScreen,
  drawCountIn,
  drawEnding,
  drawGesturePrompt,
  drawHighScores,
  drawMenuScreen,
  drawNameEntry,
  drawStatusLine,
  drawVeil,
  drawWarning,
} from '../presentation/overlays';
import { drawResults, formatTallyValues, tallyLineAppears } from '../presentation/results';
import type { FeedbackContext } from '../feedback/feedback-link';
import { RunPresenter } from '../presentation/run-presenter';
import { EFFECT_ROWS, LiveOptions } from '../options';
import type { Options, RowValue, VolumeRow } from '../options';
import { ChampionName } from '../presentation/champion-name';
import { STARFIELD_LAYERS } from '../presentation/starfield';
import type { Starfield } from '../presentation/starfield';
import { MENU_HEADER_GAP, MENU_ROW_HEIGHT } from '../presentation/menu-layout';
import type { MenuScreen } from '../presentation/menu-layout';
import { HighScoreTable } from '../hall-of-fame/high-scores';
import type { HighScoreEntry } from '../hall-of-fame/high-scores';
import { ControlsScreen } from './controls-screen';
import { HighScoresScreen } from './high-scores-screen';
import { Menu } from './menu';
import { CountryChoice } from './country-choice';
import { ANY_GESTURE, FeedbackFlow, NO_FEEDBACK } from './feedback-flow';
import type { ArmedAt, FeedbackSettings } from './feedback-flow';
import { NameEntry } from './name-entry';
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
  /** The *Audio* sub-screen, from the title's options and from the pause's (G3-2). */
  TitleAudio: 'TITLE_AUDIO',
  PauseAudio: 'PAUSE_AUDIO',
  /** The controls screen and its restore confirmation, from the title and from the pause (G1b). */
  TitleControls: 'TITLE_CONTROLS',
  TitleRestore: 'TITLE_RESTORE',
  PauseControls: 'PAUSE_CONTROLS',
  PauseRestore: 'PAUSE_RESTORE',
  /** The hall of fame (G2): the table, and the card after a cleared run. */
  HighScores: 'HIGH_SCORES',
  Ending: 'ENDING',
  NameEntry: 'NAME_ENTRY',
  /** The high scores shown on their own after the title waits (G2-3b). */
  Attract: 'ATTRACT',
  /** The country choice (GDD v0.26 §9.1): before the first run, and from each options screen. */
  StartCountry: 'START_COUNTRY',
  TitleCountry: 'TITLE_COUNTRY',
  PauseCountry: 'PAUSE_COUNTRY',
  /** The feedback offer after a run end, and the gesture prompt a gamepad opens it through. */
  FeedbackOffer: 'FEEDBACK_OFFER',
  FeedbackGesture: 'FEEDBACK_GESTURE',
} as const;
export type Scene = (typeof Scene)[keyof typeof Scene];

/** The scenes of the pause mix (ADR-0009 decision 3): the pause and its menus, not the count-in. */
const PAUSE_MIX_SCENES: ReadonlySet<Scene> = new Set([
  Scene.Paused,
  Scene.ConfirmQuit,
  Scene.PauseOptions,
  Scene.PauseEffects,
  Scene.PauseAudio,
  Scene.PauseControls,
  Scene.PauseRestore,
  Scene.PauseCountry,
]);

/** The scene machine's optional outputs besides the renderer: silent and nameless by default. */
export interface SceneOutputs {
  readonly champion?: ChampionName;
  readonly audio?: AudioPort;
  /** The feedback form (GDD v0.26 §9.1); off by default. */
  readonly feedback?: FeedbackSettings;
}

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
  [Scene.TitleAudio]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.PauseAudio]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
  [Scene.TitleControls]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.TitleRestore]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.PauseControls]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
  [Scene.PauseRestore]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
  [Scene.HighScores]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  // The run stands still behind the card, as behind the Results (GDD v0.16 §9.1).
  [Scene.Ending]: { frozen: true, scrolls: true, drawsRun: true, pauseButton: false },
  // The finished run stands still behind the grid, read for its score only (05-state-scenes).
  [Scene.NameEntry]: { frozen: true, scrolls: true, drawsRun: true, pauseButton: false },
  // The attract has the title's traits: the stars scroll, no run, no pause button.
  [Scene.Attract]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.StartCountry]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.TitleCountry]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.PauseCountry]: { frozen: true, scrolls: false, drawsRun: true, pauseButton: false },
  [Scene.FeedbackOffer]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
  [Scene.FeedbackGesture]: { frozen: false, scrolls: true, drawsRun: false, pauseButton: false },
};

/** Where each options scene's Back and sub-screen lead (meta/05-state-scenes). */
const OPTIONS_ROUTES = {
  [Scene.TitleOptions]: {
    parent: Scene.Title,
    effects: Scene.TitleEffects,
    audio: Scene.TitleAudio,
    controls: Scene.TitleControls,
    country: Scene.TitleCountry,
  },
  [Scene.PauseOptions]: {
    parent: Scene.Paused,
    effects: Scene.PauseEffects,
    audio: Scene.PauseAudio,
    controls: Scene.PauseControls,
    country: Scene.PauseCountry,
  },
} as const;
const CONTROLS_ROUTES = {
  [Scene.TitleControls]: { parent: Scene.TitleOptions, restore: Scene.TitleRestore },
  [Scene.PauseControls]: { parent: Scene.PauseOptions, restore: Scene.PauseRestore },
} as const;
/** Where each country choice leads once chosen or cancelled; the start one leads to play. */
const COUNTRY_PARENT = {
  [Scene.TitleCountry]: Scene.TitleOptions,
  [Scene.PauseCountry]: Scene.PauseOptions,
} as const;
const RESTORE_PARENT = {
  [Scene.TitleRestore]: Scene.TitleControls,
  [Scene.PauseRestore]: Scene.PauseControls,
} as const;

/** The options rows; *Controls* is hidden when the last device used is touch (GDD v0.15 §4.2). */
type OptionsRow =
  | 'visualEffects'
  | 'audio'
  | 'controls'
  | 'autofire'
  | 'language'
  | 'country'
  | 'fullscreen'
  | 'back';
const EFFECTS_PARENT = {
  [Scene.TitleEffects]: Scene.TitleOptions,
  [Scene.PauseEffects]: Scene.PauseOptions,
} as const;
const AUDIO_PARENT = {
  [Scene.TitleAudio]: Scene.TitleOptions,
  [Scene.PauseAudio]: Scene.PauseOptions,
} as const;

/**
 * Each scene's music (GDD v0.23 §9.5): the title's track on the title and its screens, the run's
 * in the run and its pause (by its boss, `runTrack`), a jingle on Game over and on the Results,
 * held over the Ending card. The adapter starts a track on a change only.
 */
const SCENE_MUSIC: Readonly<Record<Scene, Track | 'run'>> = {
  [Scene.Boot]: Track.Title,
  [Scene.Title]: Track.Title,
  [Scene.Playing]: 'run',
  [Scene.Paused]: 'run',
  [Scene.CountIn]: 'run',
  [Scene.GameOver]: Track.GameOver,
  [Scene.Results]: Track.Results,
  [Scene.ConfirmQuit]: 'run',
  [Scene.TitleOptions]: Track.Title,
  [Scene.TitleEffects]: Track.Title,
  [Scene.PauseOptions]: 'run',
  [Scene.PauseEffects]: 'run',
  [Scene.TitleAudio]: Track.Title,
  [Scene.PauseAudio]: 'run',
  [Scene.TitleControls]: Track.Title,
  [Scene.TitleRestore]: Track.Title,
  [Scene.PauseControls]: 'run',
  [Scene.PauseRestore]: 'run',
  [Scene.HighScores]: Track.Title,
  [Scene.Ending]: Track.Results,
  [Scene.NameEntry]: Track.Title,
  [Scene.Attract]: Track.Title,
  [Scene.StartCountry]: Track.Title,
  [Scene.TitleCountry]: Track.Title,
  [Scene.PauseCountry]: 'run',
  [Scene.FeedbackOffer]: Track.Title,
  [Scene.FeedbackGesture]: Track.Title,
};

const COUNT_IN_STEPS = toSteps(SceneTuning.countInSeconds);
const GAME_OVER_STEPS = toSteps(SceneTuning.gameOverSeconds);
const LOCK_STEPS = toSteps(SceneTuning.gameOverLockSeconds);
const RESULTS_LOCK_STEPS = toSteps(ResultsTuning.lockSeconds);
const RESULTS_STEPS = toSteps(ResultsTuning.autoSeconds);
/** The Ending card's lock and its time on screen (GDD v0.16 §9.1). */
const ENDING_LOCK_STEPS = toSteps(SceneTuning.endingLockSeconds);
const ENDING_STEPS = toSteps(SceneTuning.endingSeconds);
/** The attract mode's wait on the title and its time on screen (GDD v0.16 §9.1). */
const ATTRACT_IDLE_STEPS = toSteps(SceneTuning.attractIdleSeconds);
const ATTRACT_STEPS = toSteps(SceneTuning.attractSeconds);
/** The feedback offer leaves after 20 s without input (GDD v0.26 §9.1). */
const OFFER_IDLE_STEPS = toSteps(SceneTuning.feedbackOfferIdleSeconds);
/** The vertical slice has one level; the run snapshot gains its level with level 2. */
const SLICE_LEVEL = 1;

/** The title's rows; *Feedback* is last, only when the build holds a form address (§9.1). */
type TitleRow = 'play' | 'highScores' | 'options' | 'feedback';

/**
 * The two armings of a menu's feedback row `index`: a tap or click lifting over the row always
 * opens the form; `Enter` only while the row is highlighted (`[off, on]`).
 */
function rowArmings(
  menu: { readonly top: number; readonly rowHeight: number },
  index: number,
): readonly [ArmedAt, ArmedAt] {
  const top = menu.top + index * menu.rowHeight;
  const band = { top, bottom: top + menu.rowHeight };
  return [
    { band, keys: 'none' },
    { band, keys: 'confirm' },
  ];
}

function isConfirmOrTap(frame: Readonly<IntentFrame>): boolean {
  return (frame.pressed & Button.Confirm) !== 0 || frame.tapRegion !== 'none';
}

/** A menu scene: the presentation's screen description, holding a menu the scene can open. */
interface MenuScene extends MenuScreen {
  readonly menu: OpenableMenu;
}

type SceneStep = (dt: number, frame: Readonly<IntentFrame>) => void;

/** What one scene does each fixed step and draws over the field (meta/04-class-menus). */
interface SceneHandler {
  readonly step: SceneStep;
  readonly overlay: () => void;
}

const NO_OVERLAY = (): void => undefined;

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
  /** `backgroundSteps` when the run started: the champion's name runs on the run's time. */
  private runStartSteps = 0;
  /**
   * Steps since the current scene was entered (0 on the entering step): the count-in digit, the
   * Game over, Results and Ending timers, the Results lines shown, the title's steps without
   * input and the attract's time on screen.
   */
  private sceneSteps = 0;
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
  private readonly champion: ChampionName;
  /** Built with each run, so no effect or listener outlives its run (ADR-0010). */
  private presenter: RunPresenter | undefined;
  /** A frozen step ran since the last render: that frame ages no effect (count-in handoff). */
  private frozenStepSinceRender = false;
  /** Every step since Boot: the menus' clock (the re-press guard), never wall time. */
  private steps = 0;
  /** The five menus (GDD v0.13 and v0.14 §9.1), built once. */
  private readonly titleMenu: Menu<TitleRow>;
  private readonly titleScreen: MenuScene;
  /** The *Feedback* row's armings on the title, or `undefined` without a form address. */
  private readonly titleArmings: readonly [ArmedAt, ArmedAt] | undefined;
  /** The feedback offer (GDD v0.26 §9.1): *Give feedback* first, then *Later*. */
  private readonly offerMenu = new Menu(['giveFeedback', 'later'] as const, {
    headerGap: MENU_HEADER_GAP.title + MENU_ROW_HEIGHT,
  });
  private readonly offerArmings = rowArmings(this.offerMenu, 0);
  private readonly feedback: FeedbackFlow;
  private readonly feedbackVersion: string;
  /** The last run's score and level, sent with the form; 0 and 1 before any run (§9.1). */
  private lastScore = 0;
  /** The high scores were reached from a run end, so they lead to the feedback offer. */
  private highScoresAfterRun = false;
  private readonly pauseMenu = new Menu(['resume', 'options', 'quit'] as const, {
    headerGap: MENU_HEADER_GAP.title,
  });
  private readonly quitMenu = new Menu(['no', 'yes'] as const, { headerGap: MENU_HEADER_GAP.menu });
  // Called only after the constructor has set `options` (field initialisers run first).
  // Left and right flip exactly the rows that show a value (GDD v0.14 §9.1); the Country row
  // shows its code but opens a screen, so a sideways press leaves it alone (GDD v0.26 §9.3).
  private readonly hasValue = (row: MessageKey): boolean =>
    row !== 'country' && this.options.value(row) !== undefined;
  /** The value each options row shows, read at each draw; built once. */
  private readonly value = (row: MessageKey): RowValue | undefined => this.options.value(row);
  private readonly fullOptionsMenu = new Menu<OptionsRow>(
    ['visualEffects', 'audio', 'controls', 'autofire', 'language', 'country', 'fullscreen', 'back'],
    { flips: this.hasValue, headerGap: MENU_HEADER_GAP.title },
  );
  private readonly touchOptionsMenu = new Menu<OptionsRow>(
    ['visualEffects', 'audio', 'autofire', 'language', 'country', 'fullscreen', 'back'],
    { flips: this.hasValue, headerGap: MENU_HEADER_GAP.title },
  );
  /** Whether the options opened without *Controls* (touch used last), frozen until they reopen. */
  private optionsTouch = false;
  private readonly restoreMenu = new Menu(['no', 'yes'] as const, {
    headerGap: MENU_HEADER_GAP.menu,
  });
  /**
   * The device of the last input, touch included (the controls screen's own device is the last
   * of keyboard and gamepad): touch hides the *Controls* row.
   */
  private lastDevice: IntentFrame['device'] = 'keyboard';
  private readonly effectsMenu = new Menu(['allOn', 'allOff', ...EFFECT_ROWS, 'back'] as const, {
    flips: this.hasValue,
    headerGap: MENU_HEADER_GAP.menu,
  });
  /** The *Audio* sub-screen (GDD v0.23 §9.3): the two volumes, then Back. */
  private readonly audioMenu = new Menu<VolumeRow | 'back'>(['music', 'soundEffects', 'back'], {
    flips: this.hasValue,
    headerGap: MENU_HEADER_GAP.menu,
  });
  /**
   * Every menu scene: its menu and header. Drawing and opening read this one table, so a new menu
   * screen is one entry here plus its step method.
   */
  private readonly menuScreens: Readonly<Partial<Record<Scene, MenuScene>>> = {
    [Scene.FeedbackOffer]: {
      menu: this.offerMenu,
      header: { key: 'yourOpinion', font: 'title' },
      note: 'quickQuestions',
    },
    [Scene.Paused]: { menu: this.pauseMenu, header: { key: 'pause', font: 'title' } },
    [Scene.ConfirmQuit]: { menu: this.quitMenu, header: { key: 'quitQuestion', font: 'menu' } },
    [Scene.TitleOptions]: this.optionsScreen(),
    [Scene.PauseOptions]: this.optionsScreen(),
    [Scene.TitleEffects]: this.effectsScreen(),
    [Scene.PauseEffects]: this.effectsScreen(),
    [Scene.TitleAudio]: this.audioScreen(),
    [Scene.PauseAudio]: this.audioScreen(),
    [Scene.TitleRestore]: this.restoreScreen(),
    [Scene.PauseRestore]: this.restoreScreen(),
  };
  /** The options screen without *Controls*, used in place of the table's when `optionsTouch`. */
  private readonly touchOptions: MenuScene = this.touchOptionsScreen();
  private readonly controls: ControlsScreen;
  private readonly table: HighScoreTable;
  private readonly highScores = new HighScoresScreen();
  /** The final score on the Ending card, formatted once on entry. */
  private endingScore = '';
  private readonly nameEntry = new NameEntry();
  private readonly countryChoice = new CountryChoice();
  /** Every scene's step and overlay, bound once: the one place a scene is dispatched. */
  private readonly handlers: Readonly<Record<Scene, SceneHandler>>;

  private readonly audio: AudioPort;
  /** Whether the pause mix is on, so `setPaused` is called on a change only. */
  private audioPaused = false;

  /**
   * `options` are the saved ones, copied into the live options; `createRun` builds each new run
   * (tests pass a short level script, the game a seeded one); `host` hears every change;
   * `outputs.champion` draws the number 1's name in the far background (GDD v0.22 §9.4.1),
   * `outputs.audio` plays the menu sounds, the run's sounds and the pause mix (GDD v0.23 §9.5).
   */
  constructor(
    render: RenderPort,
    starfield: Starfield,
    options: Readonly<Options>,
    createRun: () => InRun,
    host: SceneHost = NO_HOST,
    highScores: readonly HighScoreEntry[] = [],
    outputs: SceneOutputs = {},
  ) {
    this.champion = outputs.champion ?? new ChampionName(() => 0);
    this.audio = outputs.audio ?? SILENT_AUDIO;
    this.table = new HighScoreTable(highScores);
    this.renderer = render;
    this.starfield = starfield;
    this.createRun = createRun;
    this.host = host;
    this.options = new LiveOptions(options);
    this.feedback = new FeedbackFlow(outputs.feedback ?? NO_FEEDBACK);
    this.feedbackVersion = outputs.feedback?.version ?? '';
    this.titleMenu = new Menu<TitleRow>(
      this.feedback.enabled
        ? ['play', 'highScores', 'options', 'feedback']
        : ['play', 'highScores', 'options'],
    );
    this.titleScreen = { menu: this.titleMenu };
    this.titleArmings = this.feedback.enabled
      ? rowArmings(this.titleMenu, this.titleMenu.rows.indexOf('feedback'))
      : undefined;
    this.controls = new ControlsScreen(this.options, host);
    this.handlers = this.buildHandlers();
    this.applyVolumes();
  }

  private buildHandlers(): Record<Scene, SceneHandler> {
    const menu = this.overlayMenu.bind(this);
    const controls = this.overlayControls.bind(this);
    const country = this.overlayCountry.bind(this);
    return {
      [Scene.Boot]: { step: this.stepBoot.bind(this), overlay: NO_OVERLAY },
      [Scene.Title]: {
        step: this.stepTitle.bind(this),
        overlay: this.overlayFeedbackMenu.bind(this),
      },
      [Scene.FeedbackOffer]: {
        step: this.stepFeedbackOffer.bind(this),
        overlay: this.overlayFeedbackMenu.bind(this),
      },
      [Scene.FeedbackGesture]: {
        step: this.stepFeedbackGesture.bind(this),
        overlay: this.overlayGesture.bind(this),
      },
      [Scene.Playing]: { step: this.stepPlaying.bind(this), overlay: NO_OVERLAY },
      [Scene.Paused]: { step: this.stepPaused.bind(this), overlay: menu },
      [Scene.CountIn]: {
        step: this.stepCountIn.bind(this),
        overlay: this.overlayCountIn.bind(this),
      },
      [Scene.GameOver]: {
        step: this.stepGameOver.bind(this),
        overlay: this.overlayGameOver.bind(this),
      },
      [Scene.Results]: {
        step: this.stepResults.bind(this),
        overlay: this.overlayResults.bind(this),
      },
      [Scene.ConfirmQuit]: { step: this.stepConfirmQuit.bind(this), overlay: menu },
      [Scene.TitleOptions]: {
        step: this.stepOptions.bind(this, Scene.TitleOptions),
        overlay: menu,
      },
      [Scene.PauseOptions]: {
        step: this.stepOptions.bind(this, Scene.PauseOptions),
        overlay: menu,
      },
      [Scene.TitleEffects]: {
        step: this.stepEffects.bind(this, Scene.TitleEffects),
        overlay: menu,
      },
      [Scene.PauseEffects]: {
        step: this.stepEffects.bind(this, Scene.PauseEffects),
        overlay: menu,
      },
      [Scene.TitleAudio]: { step: this.stepAudio.bind(this, Scene.TitleAudio), overlay: menu },
      [Scene.PauseAudio]: { step: this.stepAudio.bind(this, Scene.PauseAudio), overlay: menu },
      [Scene.TitleControls]: {
        step: this.stepControls.bind(this, Scene.TitleControls),
        overlay: controls,
      },
      [Scene.PauseControls]: {
        step: this.stepControls.bind(this, Scene.PauseControls),
        overlay: controls,
      },
      [Scene.TitleRestore]: {
        step: this.stepRestore.bind(this, Scene.TitleRestore),
        overlay: menu,
      },
      [Scene.PauseRestore]: {
        step: this.stepRestore.bind(this, Scene.PauseRestore),
        overlay: menu,
      },
      [Scene.HighScores]: {
        step: this.stepHighScores.bind(this),
        overlay: this.overlayHighScores.bind(this),
      },
      [Scene.Ending]: { step: this.stepEnding.bind(this), overlay: this.overlayEnding.bind(this) },
      [Scene.NameEntry]: {
        step: this.stepNameEntry.bind(this),
        overlay: this.overlayNameEntry.bind(this),
      },
      [Scene.Attract]: {
        step: this.stepAttract.bind(this),
        overlay: this.overlayHighScores.bind(this),
      },
      [Scene.StartCountry]: {
        step: this.stepCountry.bind(this, Scene.StartCountry),
        overlay: country,
      },
      [Scene.TitleCountry]: {
        step: this.stepCountry.bind(this, Scene.TitleCountry),
        overlay: country,
      },
      [Scene.PauseCountry]: {
        step: this.stepCountry.bind(this, Scene.PauseCountry),
        overlay: country,
      },
    };
  }

  private optionsScreen(): MenuScene {
    return {
      menu: this.fullOptionsMenu,
      header: { key: 'options', font: 'title' },
      value: this.value,
    };
  }

  private touchOptionsScreen(): MenuScene {
    return {
      menu: this.touchOptionsMenu,
      header: { key: 'options', font: 'title' },
      value: this.value,
    };
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

  private audioScreen(): MenuScene {
    return { menu: this.audioMenu, header: { key: 'audio', font: 'menu' }, value: this.value };
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
    // The form's address names the device: a new one re-arms it with a fresh context (ADR-0027).
    if (frame.device !== this.lastDevice) this.feedback.disarm();
    this.lastDevice = frame.device;
    this.handlers[this.current].step(dt, frame);
    this.audio.music(this.track());
  }

  /** The current scene's music; the run's follows its boss (GDD v0.23 §6). */
  private track(): Track | null {
    const music = SCENE_MUSIC[this.current];
    if (music !== 'run') return music;
    return this.run === undefined ? null : runTrack(this.run.snapshot().boss.state);
  }

  // Nothing to load yet (no assets, no save document). The title takes this step's frame, so a
  // press latched before the first step is not lost.
  private stepBoot(dt: number, frame: Readonly<IntentFrame>): void {
    this.openMenu(Scene.Title, frame);
    this.stepTitle(dt, frame);
  }

  // Pause is ignored on the title, as in every scene but play (pause rules). The lock ignores
  // the whole menu; Play starts a run, Options opens the options (GDD v0.14 §9.1).
  private stepTitle(_dt: number, frame: Readonly<IntentFrame>): void {
    // The title's lock counts as idle time; any physical input restarts the wait (GDD v0.16 §9.1).
    this.sceneSteps = frame.active ? 0 : this.sceneSteps + 1;
    if (this.sceneSteps >= ATTRACT_IDLE_STEPS) {
      this.openAttract();
      return;
    }
    if (this.locked()) {
      // The lock ignores the whole menu: what is held now counts as held when it ends.
      this.titleMenu.ignore(frame);
      this.feedback.disarm();
      return;
    }
    const onFeedback = this.titleMenu.rows[this.titleMenu.highlighted] === 'feedback' ? 1 : 0;
    const outcome = this.feedback.step(this.titleArmings?.[onFeedback], this.feedbackContext);
    const row = this.stepMenu(this.titleMenu, frame);
    // An opened tab counts even when the menu saw no activation (a drag, a guarded release).
    if (row === 'feedback' || outcome === 'opened') {
      this.feedbackOutcome(outcome, frame);
    } else if (row === 'options') {
      this.openMenu(Scene.TitleOptions, frame);
    } else if (row === 'highScores') {
      this.openHighScores(-1);
    } else if (row === 'play' && this.options.country === undefined) {
      // Never asked yet: the country choice first, preselected from the language (GDD v0.26 §9.1).
      this.openCountry(Scene.StartCountry, frame, this.host.countryOfLanguage());
    } else if (row === 'play') {
      this.startRun();
    }
  }

  /** The context sent with the form, read when the opening is armed (ADR-0027 decision 3). */
  private readonly feedbackContext = (): FeedbackContext => ({
    count: this.options.feedbackCount ?? 0,
    version: this.feedbackVersion,
    score: this.lastScore,
    level: SLICE_LEVEL,
    country: this.options.country,
    device: this.lastDevice,
    lang: this.options.language,
  });

  /**
   * What an activated feedback row does with the gesture's outcome (ADR-0027 decision 5): opened
   * counts and returns to the title; refused shows *OPEN BLOCKED* and stays; no opening (a gamepad,
   * no user activation) asks for a tap, click or key.
   */
  private feedbackOutcome(outcome: LinkOutcome, frame: Readonly<IntentFrame>): void {
    if (outcome === 'opened') this.feedbackOpened(frame);
    else if (outcome === 'refused') this.feedback.block();
    else this.enter(Scene.FeedbackGesture);
  }

  private feedbackOpened(frame: Readonly<IntentFrame>): void {
    this.feedback.disarm(); // the next arming builds the address of the next question set
    this.options.countFeedback();
    this.host.optionsChanged(this.options);
    if (this.current !== Scene.Title) this.toTitle(frame);
  }

  /**
   * After a run end (GDD v0.26 §9.1): the feedback offer when the build holds a form address,
   * else the title; the run is released either way.
   */
  private afterRun(frame: Readonly<IntentFrame>): void {
    if (!this.feedback.enabled) {
      this.toTitle(frame);
      return;
    }
    this.releaseRun();
    this.openMenu(Scene.FeedbackOffer, frame);
    this.lockLeft = LOCK_STEPS; // as on the title: hammering Confirm never opens a tab
  }

  // Give feedback opens the form; Later, back or 20 s without input return to the title. Pause
  // is ignored, as on the high scores (GDD v0.26 §9.1).
  private stepFeedbackOffer(_dt: number, frame: Readonly<IntentFrame>): void {
    this.sceneSteps = frame.active ? 0 : this.sceneSteps + 1;
    if (this.locked()) {
      this.offerMenu.ignore(frame);
      this.feedback.disarm();
      return;
    }
    const onGive = this.offerMenu.highlighted === 0 ? 1 : 0;
    const outcome = this.feedback.step(this.offerArmings[onGive], this.feedbackContext);
    const row = this.stepMenu(this.offerMenu, frame);
    if (row === 'giveFeedback' || outcome === 'opened') this.feedbackOutcome(outcome, frame);
    else if (row === 'later' || this.backed(frame) || this.sceneSteps >= OFFER_IDLE_STEPS) {
      this.toTitle(frame);
    }
  }

  // A gamepad cannot open a tab: the next click, tap or key opens it in its handler (ADR-0009);
  // back returns to the title, a refusal too, with *OPEN BLOCKED*.
  private stepFeedbackGesture(_dt: number, frame: Readonly<IntentFrame>): void {
    const outcome = this.feedback.step(ANY_GESTURE, this.feedbackContext);
    if (outcome === 'opened') {
      this.feedbackOpened(frame);
      return;
    }
    if (outcome === 'refused') this.feedback.block();
    if (outcome === 'refused' || this.backed(frame)) this.toTitle(frame);
  }

  /** InRun entry creates the run and its presenter. */
  private startRun(): void {
    const run = this.createRun();
    this.run = run;
    this.presenter = new RunPresenter(
      this.renderer,
      this.options.effects,
      run.events(),
      this.audio,
    );
    this.runStartSteps = this.backgroundSteps;
    this.champion.setName(this.table.entries[0]?.name ?? '');
    this.enter(Scene.Playing);
    this.host.releaseMovement();
  }

  private openCountry(
    scene: Scene,
    frame: Readonly<IntentFrame>,
    preselected: string | undefined,
  ): void {
    this.enter(scene);
    this.countryChoice.open(this.steps, frame, preselected);
  }

  // A code or NONE is saved at once; the start choice then starts the run, the options' one returns
  // to its options. Back on an empty code saves nothing: to the title or to the options (GDD v0.26).
  private stepCountry(
    scene: typeof Scene.StartCountry | keyof typeof COUNTRY_PARENT,
    _dt: number,
    frame: Readonly<IntentFrame>,
  ): void {
    const cursor = this.countryChoice.grid.cursor;
    const filled = this.countryChoice.nextSlot;
    const exit = this.countryChoice.step(frame, this.steps);
    if (exit !== undefined || this.countryChoice.nextSlot !== filled)
      this.audio.play(Sfx.MenuConfirm);
    else if (this.countryChoice.grid.cursor !== cursor) this.audio.play(Sfx.MenuMove);
    if (exit === 'chosen') {
      this.options.setCountry(this.countryChoice.choice);
      this.host.optionsChanged(this.options);
    }
    if (exit === undefined) return;
    if (scene !== Scene.StartCountry) this.openMenu(COUNTRY_PARENT[scene], frame);
    else if (exit === 'chosen') this.startRun();
    else this.openMenu(Scene.Title, frame);
  }

  // Each change applies at once and reaches the host; Back and the Back row return to the
  // parent, Visual effects opens its sub-screen (GDD v0.14 §9.1, §9.3).
  private stepOptions(
    scene: keyof typeof OPTIONS_ROUTES,
    _dt: number,
    frame: Readonly<IntentFrame>,
  ): void {
    const menu = this.optionsTouch ? this.touchOptionsMenu : this.fullOptionsMenu;
    const row = this.stepMenu(menu, frame);
    if (this.backTo(row, frame, OPTIONS_ROUTES[scene].parent)) return;
    if (row === 'visualEffects') this.openMenu(OPTIONS_ROUTES[scene].effects, frame);
    else if (row === 'audio') this.openMenu(OPTIONS_ROUTES[scene].audio, frame);
    else if (row === 'controls') this.openControls(OPTIONS_ROUTES[scene].controls, frame);
    else if (row === 'country') {
      // From the options the grid starts on the saved code, empty for NONE (GDD v0.26 §9.1).
      this.openCountry(OPTIONS_ROUTES[scene].country, frame, this.options.country);
    } else this.change(row);
  }

  private stepEffects(
    scene: keyof typeof EFFECTS_PARENT,
    _dt: number,
    frame: Readonly<IntentFrame>,
  ): void {
    const row = this.stepMenu(this.effectsMenu, frame);
    if (this.backTo(row, frame, EFFECTS_PARENT[scene])) return;
    this.change(row);
  }

  // Left and right nudge a volume by one, held at 0 and 10; an activation adds one and wraps;
  // each change applies at once, so the next menu sound plays at the new volume (GDD v0.23 §9.3).
  private stepAudio(
    scene: keyof typeof AUDIO_PARENT,
    _dt: number,
    frame: Readonly<IntentFrame>,
  ): void {
    const row = this.stepMenu(this.audioMenu, frame);
    if (this.backTo(row, frame, AUDIO_PARENT[scene])) return;
    if (row === undefined || row === 'back') return;
    const sideways = this.audioMenu.lastSideways;
    if (sideways === 0) this.options.apply(row);
    else this.options.nudge(row, sideways);
    this.applyVolumes();
    this.host.optionsChanged(this.options);
  }

  private applyVolumes(): void {
    this.audio.setVolumes(volumeGain(this.options.musicVolume), volumeGain(this.options.sfxVolume));
  }

  // The controls screen does its own work; it hands back only its two exits (GDD v0.15 §4.2).
  private stepControls(
    scene: keyof typeof CONTROLS_ROUTES,
    _dt: number,
    frame: Readonly<IntentFrame>,
  ): void {
    const row = this.controls.menu.highlighted;
    const column = this.controls.column;
    const capturing = this.controls.capturing;
    const exit = this.controls.step(frame, this.steps);
    if (exit !== undefined || this.controls.capturing !== capturing)
      this.audio.play(Sfx.MenuConfirm);
    else if (this.controls.menu.highlighted !== row || this.controls.column !== column) {
      this.audio.play(Sfx.MenuMove);
    }
    if (exit === 'back') this.openMenu(CONTROLS_ROUTES[scene].parent, frame);
    else if (exit === 'restore') this.openMenu(CONTROLS_ROUTES[scene].restore, frame);
  }

  // No is first, like Quit; Yes restores the device edited only, then back to the controls.
  private stepRestore(
    scene: keyof typeof RESTORE_PARENT,
    _dt: number,
    frame: Readonly<IntentFrame>,
  ): void {
    const row = this.stepMenu(this.restoreMenu, frame);
    if (row === 'yes') this.controls.restoreDefaults();
    if (row !== undefined || this.backed(frame)) this.openControls(RESTORE_PARENT[scene], frame);
  }

  private openControls(scene: Scene, frame: Readonly<IntentFrame>): void {
    this.enter(scene);
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
      this.enter(Scene.GameOver);
      this.lockLeft = LOCK_STEPS;
    } else if (this.run.outcome() === RunOutcome.RunCleared) {
      // `LevelCleared` (a list of several levels) is not handled: the slice has one level, and the
      // next-level flow belongs to the screens brick (ADR-0022 decision 9).
      this.enter(Scene.Results);
      this.resultsValues = formatTallyValues(this.run.tally());
      this.lockLeft = RESULTS_LOCK_STEPS;
    }
  }

  /** Enters a menu scene and opens its menu: the one place a menu is reset (first row, guard). */
  private openMenu(scene: Scene, frame: Readonly<IntentFrame>): void {
    // The options show *Controls* unless touch was used last (GDD v0.15 §4.2), fixed until they
    // reopen: a touch on the open screen never swaps its rows.
    if (scene === Scene.TitleOptions || scene === Scene.PauseOptions) {
      this.optionsTouch = this.lastDevice === 'touch';
    }
    this.enter(scene);
    this.screenOf(scene)?.menu.reset(this.steps, frame);
  }

  // Pause does nothing here: an automatic trigger can only enter the pause, never leave it. Back
  // and the pause button resume like the Resume row; Quit asks first (GDD v0.13 §9.1).
  private stepPaused(_dt: number, frame: Readonly<IntentFrame>): void {
    const row = this.stepMenu(this.pauseMenu, frame);
    if (row === 'quit') {
      this.openMenu(Scene.ConfirmQuit, frame);
    } else if (row === 'options') {
      this.openMenu(Scene.PauseOptions, frame);
    } else if (row === 'resume' || this.pauseButtonTapped(frame) || this.backed(frame)) {
      this.enter(Scene.CountIn);
      this.host.releaseMovement();
    }
  }

  // No is first, so a hurried Confirm never loses the run; Back returns to the pause, Pause is
  // ignored. Yes discards the run: no name entry, and the title is locked like after Game over.
  private stepConfirmQuit(_dt: number, frame: Readonly<IntentFrame>): void {
    const row = this.stepMenu(this.quitMenu, frame);
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
    this.sceneSteps += 1;
    if (this.sceneSteps < COUNT_IN_STEPS) return;
    this.enter(Scene.Playing);
    this.stepPlaying(dt, frame);
  }

  // The run plays on without the ship; Confirm or a tap after the lock, or the game-over time,
  // returns to the title, where the run is released and the same lock applies.
  private stepGameOver(dt: number, frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    this.run?.step(dt, frame);
    this.sceneSteps += 1;
    const confirmed = !this.locked() && isConfirmOrTap(frame);
    if (!confirmed && this.sceneSteps < GAME_OVER_STEPS) return;
    this.endRun(frame);
  }

  // Confirm or a tap after the 1 s lock, or the 8 s timer, leads a cleared run to the Ending
  // card (GDD v0.16 §9.1). Pause is ignored: the slice's Results never lead back to play.
  private stepResults(_dt: number, frame: Readonly<IntentFrame>): void {
    this.backgroundSteps += 1;
    this.sceneSteps += 1;
    if (tallyLineAppears(this.sceneSteps)) this.audio.play(Sfx.TallyTick);
    const confirmed = !this.locked() && isConfirmOrTap(frame);
    if (!confirmed && this.sceneSteps < RESULTS_STEPS) return;
    this.resultsValues = [];
    // A cleared run goes to the Ending card (GDD v0.16 §9.1); the slice-end interim is lifted.
    this.enter(Scene.Ending);
    this.endingScore = String(this.run?.snapshot().score ?? 0);
    this.lockLeft = ENDING_LOCK_STEPS;
  }

  // Confirm or a tap after the 1 s lock, or 6 s, leaves the card (GDD v0.16 §9.1).
  private stepEnding(_dt: number, frame: Readonly<IntentFrame>): void {
    // The stars keep moving over the frozen run, as on the Results.
    this.backgroundSteps += 1;
    this.sceneSteps += 1;
    const confirmed = !this.locked() && isConfirmOrTap(frame);
    if (!confirmed && this.sceneSteps < ENDING_STEPS) return;
    this.endingScore = '';
    this.endRun(frame);
  }

  /** After Game over or the Ending: the name entry when the score enters the table, else the title. */
  private endRun(frame: Readonly<IntentFrame>): void {
    const score = this.run?.snapshot().score ?? 0;
    this.lastScore = score;
    if (!this.table.qualifies(score)) {
      this.afterRun(frame);
      return;
    }
    this.enter(Scene.NameEntry);
    this.nameEntry.open(this.steps, frame, score, this.options.country);
  }

  // Pause is ignored: no run steps here. SKIP, or OK on an empty name, records nothing; an entry
  // is inserted, saved through the host and shown highlighted (SD-score).
  private stepNameEntry(_dt: number, frame: Readonly<IntentFrame>): void {
    // The stars keep moving over the frozen run, as on the Results and the Ending.
    this.backgroundSteps += 1;
    const cursor = this.nameEntry.grid.cursor;
    const filled = this.nameEntry.nextSlot;
    const exit = this.nameEntry.step(frame, this.steps);
    const typed = this.nameEntry.nextSlot !== filled;
    if (exit !== undefined || typed) this.audio.play(Sfx.MenuConfirm);
    else if (this.nameEntry.grid.cursor !== cursor) this.audio.play(Sfx.MenuMove);
    if (exit === 'skipped') {
      this.afterRun(frame);
    } else if (exit === 'entered') {
      const rank = this.table.insert(this.nameEntry.entry(this.host.today()));
      this.host.highScoresChanged(this.table.entries);
      this.releaseRun();
      this.openHighScores(rank);
      this.highScoresAfterRun = true;
    }
  }

  /** The high scores on their own, no row highlighted (-1, GDD v0.16 §9.1). */
  private openAttract(): void {
    this.enter(Scene.Attract);
    this.highScores.open(this.table, -1);
  }

  // Any physical input, or 6 s, returns to the title with the opening guard and no lock: the
  // input that ended the attract does nothing else (GDD v0.16 §9.1); the Pause key is one.
  private stepAttract(_dt: number, frame: Readonly<IntentFrame>): void {
    this.sceneSteps += 1;
    if (frame.active || this.sceneSteps >= ATTRACT_STEPS) this.openMenu(Scene.Title, frame);
  }

  private openHighScores(highlighted: number): void {
    this.enter(Scene.HighScores);
    this.highScores.open(this.table, highlighted);
    this.highScoresAfterRun = false;
  }

  // Back, confirm or a tap started here returns to the title, locked as after Game over; after a
  // run, through the feedback offer (GDD v0.26 §9.1).
  private stepHighScores(_dt: number, frame: Readonly<IntentFrame>): void {
    if (!this.highScores.step(frame)) return;
    if (this.highScoresAfterRun) this.afterRun(frame);
    else this.toTitle(frame);
  }

  /** The run is released at the title, locked for 1 s so hammering never starts a new run. */
  private toTitle(frame: Readonly<IntentFrame>): void {
    this.releaseRun();
    this.openMenu(Scene.Title, frame);
    this.lockLeft = LOCK_STEPS;
  }

  /** The run and its presenter are released. */
  private releaseRun(): void {
    this.run = undefined;
    this.presenter = undefined;
  }

  /** Every scene change goes through here, so each scene's timer starts at 0. */
  private enter(scene: Scene): void {
    // An opening stays armed on its own screen only (ADR-0027 decision 5).
    if (scene !== this.current) this.feedback.disarm();
    this.current = scene;
    this.sceneSteps = 0;
    // The pause mix (ADR-0009 decision 3): on in the pause and its menus, off from the count-in.
    const paused = PAUSE_MIX_SCENES.has(scene);
    if (paused !== this.audioPaused) this.audio.setPaused(paused);
    this.audioPaused = paused;
  }

  /** One step of a menu, with its sounds: a move of the highlight, an activation (GDD §9.5). */
  private stepMenu<Id extends MessageKey>(
    menu: Menu<Id>,
    frame: Readonly<IntentFrame>,
  ): Id | undefined {
    const before = menu.highlighted;
    const row = menu.step(frame, this.steps);
    if (row !== undefined) this.audio.play(Sfx.MenuConfirm);
    else if (menu.highlighted !== before) this.audio.play(Sfx.MenuMove);
    return row;
  }

  /** The menu screen of a scene: the table's, or the options without *Controls* on touch. */
  private screenOf(scene: Scene): MenuScene | undefined {
    if (scene === Scene.Title) return this.titleScreen;
    const touchOptions = scene === Scene.TitleOptions || scene === Scene.PauseOptions;
    return touchOptions && this.optionsTouch ? this.touchOptions : this.menuScreens[scene];
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
    const background = (this.backgroundSteps + scroll) * STEP_SECONDS;
    // The champion's name sits between the far star layer and the nearer ones (GDD v0.22 §9.4.1).
    this.starfield.drawLayers(r, background, 0, 1);
    // Shown in play, and frozen with the stars in the pause and its screens (frozen, not scrolling).
    const inPlay = this.current === Scene.Playing || (traits.frozen && !traits.scrolls);
    if (inPlay && this.options.effects.championName) {
      this.champion.draw(r, background - this.runStartSteps * STEP_SECONDS);
    }
    this.starfield.drawLayers(r, background, 1, STARFIELD_LAYERS.length);
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
    this.handlers[this.current].overlay();
    r.present();
  }

  private overlayMenu(): void {
    const menuScreen = this.screenOf(this.current);
    if (menuScreen !== undefined) drawMenuScreen(this.renderer, menuScreen, this.options.language);
  }

  /** The title or the offer, with *OPEN BLOCKED* over it for 2 s after a refused tab. */
  private overlayFeedbackMenu(): void {
    this.overlayMenu();
    if (this.feedback.blocked) drawStatusLine(this.renderer, 'openBlocked', this.options.language);
  }

  private overlayGesture(): void {
    drawGesturePrompt(this.renderer, this.options.language);
  }

  private overlayControls(): void {
    drawControlsScreen(this.renderer, this.controls, this.options.language);
  }

  private overlayCountIn(): void {
    drawCountIn(this.renderer, COUNT_IN_STEPS - this.sceneSteps);
  }

  private overlayGameOver(): void {
    drawVeil(this.renderer);
    drawBanner(this.renderer, message('gameOver', this.options.language));
  }

  private overlayResults(): void {
    drawResults(this.renderer, this.resultsValues, this.sceneSteps, this.options.language);
  }

  private overlayHighScores(): void {
    drawHighScores(this.renderer, this.highScores, this.options.language);
  }

  private overlayEnding(): void {
    drawEnding(this.renderer, this.endingScore, this.options.language);
  }

  private overlayCountry(): void {
    drawNameEntry(this.renderer, this.countryChoice, this.options.language);
  }

  private overlayNameEntry(): void {
    drawNameEntry(this.renderer, this.nameEntry, this.options.language);
  }
}
