import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import type { Random } from '../ports/random';
import { mixSeed, SeededRandom } from '../random/seeded-random';
import type { ReadonlyActiveList } from './active-list';
import type { Bullet } from './bullet';
import type { BossState } from './boss';
import { CollisionResolver } from './collision';
import type { Enemy } from './enemy';
import { EventBus } from './events';
import type { RunEvents } from './events';
import type { Vec2 } from './geometry';
import { LevelDirector } from './level-director';
import { LEVEL_1 } from './level-script';
import type { LevelScript } from './level-script';
import type { Pickup } from './pickup';
import { PlayerState } from './player';
import { RunRules } from './run-rules';
import { ScoreKeeper } from './score-keeper';
import { WeaponKind } from './weapon';
import { World } from './world';

/**
 * How a run is built (class diagram, ADR-0019). The composition root draws `seed`; tests give a
 * short script, a fixed seed, or a scripted `Random` through `createRandom`, called once per level.
 * `levels` is the run's level list (the vertical slice holds level 1 only); `script` is a single
 * level, a shorthand for a list of one, and `levels` wins when both are given.
 */
export interface RunConfig {
  readonly script?: LevelScript;
  readonly levels?: readonly LevelScript[];
  readonly seed?: number;
  readonly createRandom?: (levelSeed: number) => Random;
}

function seededRandom(levelSeed: number): Random {
  return new SeededRandom(levelSeed);
}

/**
 * How a run stands after a step (class diagram): `LEVEL_CLEARED` when a level ends and another
 * follows, `RUN_CLEARED` when the last level of the list ends (ADR-0022 decision 6).
 */
export const RunOutcome = {
  Playing: 'PLAYING',
  GameOver: 'GAME_OVER',
  LevelCleared: 'LEVEL_CLEARED',
  RunCleared: 'RUN_CLEARED',
} as const;
export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome];

/** The ship as the presenter sees it. */
export interface PlayerSnapshot {
  readonly position: Readonly<Vec2>;
  readonly previousPosition: Readonly<Vec2>;
  readonly state: PlayerState;
  /** Steps since the protection began: the blink phase (05-state-player). */
  readonly protectionSteps: number;
}

/**
 * The boss as the presenter sees it (ADR-0023 decision 5): getters over the live boss, so reading
 * it allocates nothing. `stateSteps` drives the WARNING blink from the state, never from wall time.
 */
export interface BossSnapshot {
  /** The boss's serial, the subject of its `ENEMY_HIT` (the white flash). */
  readonly serial: number;
  readonly state: BossState;
  readonly position: Readonly<Vec2>;
  readonly previousPosition: Readonly<Vec2>;
  readonly width: number;
  readonly height: number;
  /** The HP bar, 0 to 1. */
  readonly hpRatio: number;
  /** The whole seconds left on the timer, as the HUD shows them. */
  readonly secondsLeft: number;
  /** The index of the phase fighting (0 for the first). */
  readonly phase: number;
  /** Steps spent in the current state. */
  readonly stateSteps: number;
}

/**
 * The read-only view the presenter draws from (`RunView.snapshot()`), returned without allocating:
 * it reads the live objects of the run. HUD values are getters (class diagram notes, HUD data).
 */
export interface WorldSnapshot {
  readonly player: PlayerSnapshot;
  readonly playerBullets: ReadonlyActiveList<Bullet>;
  readonly enemyBullets: ReadonlyActiveList<Bullet>;
  readonly enemies: ReadonlyActiveList<Enemy>;
  readonly pickups: ReadonlyActiveList<Pickup>;
  readonly boss: BossSnapshot;
  readonly weaponKind: WeaponKind;
  /** The power level, 1 to 5 (the HUD pips). */
  readonly power: number;
  /** Bombs in stock, 0 to 5. */
  readonly bombs: number;
  /** A shield charge is held. */
  readonly shield: boolean;
  /** Lives left, the ship in play included; the HUD shows the reserve, `lives − 1`. */
  readonly lives: number;
  readonly score: number;
  readonly multiplier: number;
  /** The chain bar, 0 to 1. */
  readonly chainRatio: number;
}

/** What the scene machine may do with a run: step it and read it (class diagram, view A). */
export interface Simulation {
  step(dt: number, frame: Readonly<IntentFrame>): void;
}

/** What the presenter and the scene machine read of a run, never write (class diagram, view A). */
export interface RunView {
  outcome(): RunOutcome;
  snapshot(): WorldSnapshot;
  /** Subscribe-only: listeners can never publish (ADR-0010). */
  events(): RunEvents;
}

/**
 * The simulation of one run (class diagram: `Simulation`, `RunView`); the rules live in `RunRules`. `step` follows
 * the fixed order of the class diagram.
 */
export class Run implements Simulation, RunView {
  private readonly world = new World();
  private readonly director: LevelDirector;
  private readonly bus = new EventBus();
  // Built right after the bus, so it is subscribed first (ADR-0010 wording note).
  private readonly scoreKeeper = new ScoreKeeper(this.bus);
  private currentOutcome: RunOutcome = RunOutcome.Playing;
  private readonly snapshotView: WorldSnapshot = createSnapshot(this.world, this.scoreKeeper);
  /** The run's level list; the slice plays its first level only (`startNextLevel` waits for level 2). */
  private readonly levels: readonly LevelScript[];
  /** The boss sequence ended (destroyed or fled): the level end waits for a living ship (step 8). */
  private bossSequenceEnded = false;
  /**
   * The rules the run applies to the world. Public as the seam the collision resolver and the
   * level director call (`HitRules`, `EnemySpawner`) and tests drive directly (ADR-0023 decision 7).
   */
  readonly rules: RunRules;

  constructor(config: RunConfig = {}) {
    this.levels = config.levels ?? [config.script ?? LEVEL_1];
    const first = this.levels[0];
    if (first === undefined) throw new RangeError('Run: needs at least one level');
    this.director = new LevelDirector(first);
    // Drops only (ADR-0010 decision 1); level 1 is seeded with mixSeed(seed, 0) (ADR-0019).
    const random = (config.createRandom ?? seededRandom)(mixSeed(config.seed ?? 0, 0));
    this.rules = new RunRules(this.world, this.bus, random, first);
  }

  /**
   * One fixed step; `dt` is in seconds (ADR-0014). After `GAME_OVER` the run plays on without the
   * ship, as on an arcade cabinet (GDD v0.6 §4.4): the ship stays out and the score never moves.
   */
  step(dt: number, frame: Readonly<IntentFrame>): void {
    // (1) the level script spawns what is due, through the run (refusals settle formations).
    this.director.tick(this.rules);
    // (2) the player moves and its weapon fires.
    this.world.player.update(frame, dt, this.world);
    // (3) a bomb pressed in control goes off, before this step's collisions.
    if ((frame.pressed & Button.Bomb) !== 0 && this.world.player.useBomb()) this.rules.detonate();
    // (4) enemies move and attack, then every bullet and every pickup moves.
    this.world.moveEnemies(dt);
    this.world.moveBullets(dt);
    this.world.movePickups();
    // (5) collisions only mark; (6) the single release point.
    CollisionResolver.resolve(this.world, this.rules);
    this.world.sweep();
    // (7) timers advance: the chain, then the ship.
    this.scoreKeeper.tick();
    this.world.player.advanceTimers();
    if (this.rules.advanceBoss()) this.bossSequenceEnded = true;
    // (8) the outcome: Game over once the last death sequence has ended, which wins over a
    // pending level end. The ship's last bullets are spent then, so nothing scores while the run
    // plays on.
    if (this.currentOutcome !== RunOutcome.Playing) return;
    if (this.world.player.isOut) {
      this.currentOutcome = RunOutcome.GameOver;
      this.world.spendPlayerBullets();
    } else if (this.bossSequenceEnded && this.world.player.state !== PlayerState.Dead) {
      this.clearLevel();
    }
  }

  outcome(): RunOutcome {
    return this.currentOutcome;
  }

  snapshot(): WorldSnapshot {
    return this.snapshotView;
  }

  events(): RunEvents {
    return this.bus;
  }

  /**
   * Step 8, once the boss sequence has ended and the ship is not `Dead`: the ship's bullets are
   * spent, `LEVEL_CLEARED` carries the bombs left, and the outcome is `RUN_CLEARED` after the last
   * level of the list, `LEVEL_CLEARED` before it.
   */
  private clearLevel(): void {
    this.bossSequenceEnded = false;
    this.world.spendPlayerBullets();
    this.rules.levelCleared();
    this.currentOutcome = this.levels.length > 1 ? RunOutcome.LevelCleared : RunOutcome.RunCleared;
  }
}

function createSnapshot(world: World, scoreKeeper: ScoreKeeper): WorldSnapshot {
  return {
    player: world.player,
    playerBullets: world.playerBullets,
    enemyBullets: world.enemyBullets,
    enemies: world.enemies,
    pickups: world.pickups,
    boss: createBossSnapshot(world),
    get weaponKind(): WeaponKind {
      return world.player.weaponKind;
    },
    get power(): number {
      return world.player.power;
    },
    get bombs(): number {
      return world.player.bombs;
    },
    get shield(): boolean {
      return world.player.shield;
    },
    get lives(): number {
      return world.player.lives;
    },
    get score(): number {
      return scoreKeeper.score;
    },
    get multiplier(): number {
      return scoreKeeper.multiplier;
    },
    get chainRatio(): number {
      return scoreKeeper.chainRatio;
    },
  };
}

function createBossSnapshot(world: World): BossSnapshot {
  const boss = world.boss;
  return {
    position: boss.position,
    previousPosition: boss.previousPosition,
    get serial(): number {
      return boss.serial;
    },
    get state(): BossState {
      return boss.state;
    },
    get width(): number {
      return boss.width;
    },
    get height(): number {
      return boss.height;
    },
    get hpRatio(): number {
      return boss.hpRatio();
    },
    get secondsLeft(): number {
      return boss.secondsLeft();
    },
    get phase(): number {
      return boss.phaseIndex;
    },
    get stateSteps(): number {
      return boss.stateSteps;
    },
  };
}
