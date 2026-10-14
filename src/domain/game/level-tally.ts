import { GameEventKind } from './events';
import type { GameEvent, RunEvents } from './events';
import { TallyTuning } from './tuning';

/**
 * The read-only view of the tally the Results scene draws from (`RunView.tally()`): no setter and
 * no reset, so nothing outside the score can change a line.
 */
export interface TallyView {
  /** Whole formations destroyed in the level, those completed by a bomb included. */
  readonly formationsCleared: number;
  /** A bomb went off in the level: the no-bomb bonus is lost. */
  readonly bombUsed: boolean;
  /** A life was lost in the level: the no-miss bonus is lost (a shield absorb is not). */
  readonly lifeLost: boolean;
  /** The bombs left when the level ended; 0 until then. */
  readonly bombsLeft: number;
  /** The sum of the four lines, the bonus added to the score. */
  total(): number;
}

/**
 * The end-of-level tally (GDD v0.10 §8, ADR-0022 decision 7). A subscriber rather than a call in
 * the step: it reads the events the run already publishes, so the step needs no new line, and a
 * formation completed by a bomb counts because the bomb's kills publish `FORMATION_CLEARED` like
 * any other. `ScoreKeeper` owns it and subscribes it before its own `LEVEL_CLEARED` handler, so the
 * bombs left are recorded before the total is added. The boss bonus is not a line: it is scored on
 * `BOSS_DESTROYED`.
 */
export class LevelTally implements TallyView {
  private formations = 0;
  private bombed = false;
  private died = false;
  private bombsAtEnd = 0;

  constructor(events: RunEvents) {
    events.subscribe(GameEventKind.FormationCleared, this.onFormationCleared);
    events.subscribe(GameEventKind.BombUsed, this.onBombUsed);
    events.subscribe(GameEventKind.PlayerDied, this.onPlayerDied);
    events.subscribe(GameEventKind.LevelCleared, this.onLevelCleared);
  }

  get formationsCleared(): number {
    return this.formations;
  }

  get bombUsed(): boolean {
    return this.bombed;
  }

  get lifeLost(): boolean {
    return this.died;
  }

  get bombsLeft(): number {
    return this.bombsAtEnd;
  }

  total(): number {
    return (
      this.formations * TallyTuning.perFormation +
      (this.bombed ? 0 : TallyTuning.noBomb) +
      (this.died ? 0 : TallyTuning.noMiss) +
      this.bombsAtEnd * TallyTuning.perBombLeft
    );
  }

  private readonly onFormationCleared = (): void => {
    this.formations += 1;
  };

  private readonly onBombUsed = (): void => {
    this.bombed = true;
  };

  private readonly onPlayerDied = (): void => {
    this.died = true;
  };

  private readonly onLevelCleared = (event: Readonly<GameEvent>): void => {
    this.bombsAtEnd = event.value;
  };
}
