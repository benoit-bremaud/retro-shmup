import { GameEventKind } from './events';
import type { GameEvent, RunEvents } from './events';
import { LevelTally } from './level-tally';
import type { TallyView } from './level-tally';
import { BossTuning, ChainTuning, toSteps } from './tuning';

const WINDOW_STEPS = toSteps(ChainTuning.windowSeconds);
const NO_CHAIN = -1;

/**
 * Points, the chain multiplier, the flat cap bonus of a collected pickup, the flat boss bonus and
 * the end-of-level tally, added flat at `LEVEL_CLEARED` (GDD §8, v0.8 §4.6, v0.10 §6, class
 * diagram). `Run`'s constructor subscribes it first (ADR-0010 wording note), so the score is
 * counted with or without a presenter.
 *
 * `chainTimer` counts the steps left in the window: 120 on a kill, −1 with no chain. `tick` runs at
 * step 7, after the collisions, and the chain breaks when the timer falls below 0, so a kill 120
 * steps after the previous one still extends it (inclusive window, GDD v0.6 §8).
 */
export class ScoreKeeper {
  private points = 0;
  private chainKills = 0;
  private chainTimer = NO_CHAIN;
  private readonly levelTally: LevelTally;

  constructor(events: RunEvents) {
    // Subscribed before this keeper's LEVEL_CLEARED handler, so the bombs left are counted first.
    this.levelTally = new LevelTally(events);
    events.subscribe(GameEventKind.EnemyDestroyed, this.onEnemyDestroyed);
    events.subscribe(GameEventKind.PlayerDied, this.onPlayerDied);
    events.subscribe(GameEventKind.PickupCollected, this.onPickupCollected);
    events.subscribe(GameEventKind.BossDestroyed, this.onBossDestroyed);
    events.subscribe(GameEventKind.LevelCleared, this.onLevelCleared);
  }

  /** The current level's tally, read-only (ADR-0022 decision 7). */
  get tally(): TallyView {
    return this.levelTally;
  }

  get score(): number {
    return this.points;
  }

  /** ×1 to ×8: steps up every 5 chained kills (GDD §8). */
  get multiplier(): number {
    return Math.min(
      1 + Math.floor(this.chainKills / ChainTuning.killsPerStep),
      ChainTuning.maxMultiplier,
    );
  }

  /** The chain bar, 0 to 1: full right after a kill, empty exactly when the chain breaks. */
  get chainRatio(): number {
    return (this.chainTimer + 1) / WINDOW_STEPS;
  }

  /** Step 7 of `Run.step`. */
  tick(): void {
    if (this.chainTimer < 0) return;
    this.chainTimer -= 1;
    if (this.chainTimer < 0) this.chainKills = 0;
  }

  // A kill is scored at the current multiplier, then the chain steps up (GDD v0.4 §8).
  private readonly onEnemyDestroyed = (event: Readonly<GameEvent>): void => {
    this.points += event.value * this.multiplier;
    this.chainKills += 1;
    this.chainTimer = WINDOW_STEPS;
  };

  // The cap bonus is flat: never multiplied, and the chain does not move (GDD v0.8 §4.6).
  private readonly onPickupCollected = (event: Readonly<GameEvent>): void => {
    this.points += event.value;
  };

  // The boss bonus is flat too, and neither extends nor breaks the chain (GDD v0.10 §6): `value`
  // is the whole seconds the HUD showed.
  private readonly onBossDestroyed = (event: Readonly<GameEvent>): void => {
    this.points += BossTuning.bonus + BossTuning.bonusPerSecond * event.value;
  };

  // The tally is flat too: added once when the level ends, the chain unchanged (GDD v0.10 §8).
  private readonly onLevelCleared = (): void => {
    this.points += this.levelTally.total();
  };

  private readonly onPlayerDied = (): void => {
    this.chainKills = 0;
    this.chainTimer = NO_CHAIN;
  };
}
