import { MENU_FONT_CELL } from '../ports/render-port';
import type { RenderPort } from '../ports/render-port';
import { FIELD_HEIGHT, FIELD_WIDTH } from './screen';
import { STARFIELD_LAYERS } from './starfield';

/** When and how fast the champion's name passes (GDD v0.22 §9.4.1). */
export const ChampionTuning = {
  /** The first pass starts this long after the run starts… */
  firstAtS: 40,
  /** …and a new one every this long. */
  everyS: 120,
  /** The far star layer's speed, in play-field pixels per second. */
  speed: STARFIELD_LAYERS[0]?.speed ?? 12,
} as const;

/**
 * The hall-of-fame number 1's name drifting dimly through the far background of a run (GDD v0.22
 * §9.4.1, render/04-class-champion-name). Its height is a pure function of the run's background
 * time, like the stars; only the x of each pass is drawn, once, from the injected presentation
 * randomness (ADR-0010), so drawing allocates nothing.
 */
export class ChampionName {
  private name = '';
  private pass = -1;
  private x = 0;
  private readonly random: () => number;

  /** `random` is the unseeded presentation randomness that places each pass (ADR-0010). */
  constructor(random: () => number) {
    this.random = random;
  }

  /** The name for the next run; an empty name (empty table) draws nothing. */
  setName(name: string): void {
    this.name = name.trim();
    this.pass = -1;
  }

  /** Draws in the current region, the play field, at `runSeconds` of background time. */
  draw(render: RenderPort, runSeconds: number): void {
    if (this.name === '') return;
    const sinceFirst = runSeconds - ChampionTuning.firstAtS;
    if (sinceFirst < 0) return;
    const pass = Math.floor(sinceFirst / ChampionTuning.everyS);
    const y =
      -MENU_FONT_CELL.height + ChampionTuning.speed * (sinceFirst - pass * ChampionTuning.everyS);
    if (y >= FIELD_HEIGHT) return;
    if (pass !== this.pass) {
      this.pass = pass;
      const room = FIELD_WIDTH - this.name.length * MENU_FONT_CELL.width;
      this.x = Math.floor(this.random() * Math.max(room, 0));
    }
    render.drawText(this.name, this.x, Math.floor(y), 'far');
  }
}
