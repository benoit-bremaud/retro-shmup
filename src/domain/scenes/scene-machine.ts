import { Run } from '../game/run';
import { STEPS_PER_SECOND } from '../game/tuning';
import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { RenderPort } from '../ports/render-port';
import { Palette } from '../presentation/palette';
import { RunPresenter } from '../presentation/run-presenter';
import type { EffectSettings } from '../presentation/run-presenter';
import { FIELD_WIDTH, FIELD_X, HUD_BAND_WIDTH, SCREEN_HEIGHT } from '../presentation/screen';
import type { Starfield } from '../presentation/starfield';

/** The scenes of the first-playable subset (meta/05-state-scenes). */
export const Scene = {
  Boot: 'BOOT',
  Title: 'TITLE',
  Playing: 'PLAYING',
} as const;
export type Scene = (typeof Scene)[keyof typeof Scene];

const STEP_SECONDS = 1 / STEPS_PER_SECOND;

/**
 * The screens and their transitions, first-playable subset (meta/05-state-scenes): Boot → Title →
 * InRun { Playing }. It satisfies the frame loop's `FrameTarget` structurally, so the domain
 * never imports the loop. It owns the background clock, so the starfield scrolls on the title and
 * in play without a jump at the start.
 */
export class SceneMachine {
  private current: Scene = Scene.Boot;
  private run: Run | undefined;
  private backgroundSteps = 0;
  private readonly renderer: RenderPort;
  private readonly starfield: Starfield;
  private readonly presenter: RunPresenter;

  constructor(render: RenderPort, starfield: Starfield, effects: Readonly<EffectSettings>) {
    this.renderer = render;
    this.starfield = starfield;
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
        // Nothing to load yet (no assets, no save document).
        this.current = Scene.Title;
        return;
      case Scene.Title:
        this.backgroundSteps += 1;
        // Pause is ignored here, as in every scene but play (pause rules).
        if ((frame.pressed & Button.Confirm) !== 0 || frame.tapRegion !== 'none') {
          this.run = new Run(); // InRun entry creates the run.
          this.current = Scene.Playing;
        }
        return;
      case Scene.Playing:
        this.backgroundSteps += 1;
        // Interim deviation: Pause is ignored until the Paused scene lands (05-state-scenes).
        this.run?.step(dt, frame);
        return;
    }
  }

  render(alpha: number, _wallDtMs: number): void {
    const r = this.renderer;
    r.clear();
    r.setRegion('field');
    this.starfield.draw(r, (this.backgroundSteps + alpha) * STEP_SECONDS);
    if (this.current === Scene.Playing && this.run !== undefined) {
      this.presenter.draw(this.run.snapshot(), alpha);
    }
    r.setRegion('hud');
    this.drawHudBands();
    r.present();
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
