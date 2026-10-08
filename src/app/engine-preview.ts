import type { RenderPort } from '../domain/ports/render-port';
import { Palette } from '../domain/presentation/palette';
import { FIELD_WIDTH, FIELD_X, HUD_BAND_WIDTH, SCREEN_HEIGHT } from '../domain/presentation/screen';
import type { Starfield } from '../domain/presentation/starfield';
import { STEP_SECONDS } from './frame-loop';
import type { FrameTarget } from './frame-loop';

/**
 * Temporary frame target of the engine brick: scrolls the starfield in the play field and draws
 * the empty HUD bands. The scene machine (meta/05-state-scenes) replaces it.
 */
export class EnginePreview implements FrameTarget {
  private scrollSeconds = 0;
  private readonly renderer: RenderPort;
  private readonly starfield: Starfield;

  constructor(renderer: RenderPort, starfield: Starfield) {
    this.renderer = renderer;
    this.starfield = starfield;
  }

  timeScale(): number {
    return 1;
  }

  step(dtSeconds: number): void {
    this.scrollSeconds += dtSeconds;
  }

  render(alpha: number): void {
    const r = this.renderer;
    r.clear();
    r.setRegion('field');
    this.starfield.draw(r, this.scrollSeconds + alpha * STEP_SECONDS);
    r.setRegion('hud');
    const rightBandX = FIELD_X + FIELD_WIDTH;
    r.drawRect(0, 0, HUD_BAND_WIDTH, SCREEN_HEIGHT, Palette.hudBand);
    r.drawRect(rightBandX, 0, HUD_BAND_WIDTH, SCREEN_HEIGHT, Palette.hudBand);
    r.drawRect(FIELD_X - 1, 0, 1, SCREEN_HEIGHT, Palette.hudEdge);
    r.drawRect(rightBandX, 0, 1, SCREEN_HEIGHT, Palette.hudEdge);
    r.present();
  }
}
