import type { IntentFrame } from '../ports/input-port';
import type { ReadonlyActiveList } from './active-list';
import type { Bullet } from './bullet';
import { CollisionResolver } from './collision';
import type { HitRules } from './collision';
import type { Enemy } from './enemy';
import { createGameEvent, EventBus, GameEventKind } from './events';
import type { RunEvents } from './events';
import type { Vec2 } from './geometry';
import { LevelDirector } from './level-director';
import { LEVEL_1 } from './level-script';
import type { LevelScript } from './level-script';
import type { PlayerState } from './player';
import { ScoreKeeper } from './score-keeper';
import { World } from './world';

/** How a run stands after a step (class diagram); levels end with the level brick. */
export const RunOutcome = {
  Playing: 'PLAYING',
  GameOver: 'GAME_OVER',
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
 * The read-only view the presenter draws from (`RunView.snapshot()`), returned without allocating:
 * it reads the live objects of the run. HUD values are getters (class diagram notes, HUD data).
 */
export interface WorldSnapshot {
  readonly player: PlayerSnapshot;
  readonly playerBullets: ReadonlyActiveList<Bullet>;
  readonly enemyBullets: ReadonlyActiveList<Bullet>;
  readonly enemies: ReadonlyActiveList<Enemy>;
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

export interface RunView {
  outcome(): RunOutcome;
  snapshot(): WorldSnapshot;
  /** Subscribe-only: listeners can never publish (ADR-0010). */
  events(): RunEvents;
}

/**
 * The simulation of one run (class diagram: `Simulation`, `RunView`, `HitRules`). `step` follows
 * the fixed order of the class diagram; the bomb slot (3) arrives with the pickups and rules brick.
 */
export class Run implements Simulation, RunView, HitRules {
  private readonly world = new World();
  private readonly director: LevelDirector;
  private readonly bus = new EventBus();
  // Built right after the bus, so it is subscribed first (ADR-0010 wording note).
  private readonly scoreKeeper = new ScoreKeeper(this.bus);
  private readonly enemyHitEvent = createGameEvent(GameEventKind.EnemyHit);
  private readonly enemyDestroyedEvent = createGameEvent(GameEventKind.EnemyDestroyed);
  private readonly playerDiedEvent = createGameEvent(GameEventKind.PlayerDied);
  private currentOutcome: RunOutcome = RunOutcome.Playing;
  private readonly snapshotView: WorldSnapshot = createSnapshot(this.world, this.scoreKeeper);

  constructor(script: LevelScript = LEVEL_1) {
    this.director = new LevelDirector(script);
  }

  /**
   * One fixed step; `dt` is in seconds (ADR-0014). After `GAME_OVER` the run plays on without the
   * ship, as on an arcade cabinet (GDD v0.6 §4.4): the ship stays out and the score never moves.
   */
  step(dt: number, frame: Readonly<IntentFrame>): void {
    // (1) the level script spawns what is due.
    this.director.tick(this.world);
    // (2) the player moves and its weapon fires.
    this.world.player.update(frame, dt, this.world);
    // (4) enemies move and attack, then every bullet moves.
    this.world.moveEnemies(dt);
    this.world.moveBullets(dt);
    // (5) collisions only mark; (6) the single release point.
    CollisionResolver.resolve(this.world, this);
    this.world.sweep();
    // (7) timers advance: the chain, then the ship.
    this.scoreKeeper.tick();
    this.world.player.advanceTimers();
    // (8) the outcome: Game over once the last death sequence has ended. The ship's last
    // bullets are spent then, so nothing scores while the run plays on.
    if (this.currentOutcome === RunOutcome.Playing && this.world.player.isOut) {
      this.currentOutcome = RunOutcome.GameOver;
      this.world.spendPlayerBullets();
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

  /** `HitRules`: a shot touched a live enemy (white flash). */
  enemyHit(enemy: Enemy): void {
    const event = this.enemyHitEvent;
    event.position.x = enemy.position.x;
    event.position.y = enemy.position.y;
    event.subject = enemy.serial;
    event.value = 0;
    event.detail = 0;
    this.bus.publish(event);
  }

  /** `HitRules`: marks the enemy; it is released at step 6, so the event carries all it needs. */
  destroyEnemy(enemy: Enemy): void {
    enemy.spent = true;
    const event = this.enemyDestroyedEvent;
    event.position.x = enemy.position.x;
    event.position.y = enemy.position.y;
    event.subject = enemy.serial;
    event.value = enemy.archetype.stats.score;
    event.detail = enemy.archetype.stats.tier;
    this.bus.publish(event);
  }

  /** `HitRules`: the ship died this step. */
  playerDied(): void {
    const event = this.playerDiedEvent;
    event.position.x = this.world.player.position.x;
    event.position.y = this.world.player.position.y;
    event.subject = 0;
    event.value = 0;
    event.detail = 0;
    this.bus.publish(event);
  }
}

function createSnapshot(world: World, scoreKeeper: ScoreKeeper): WorldSnapshot {
  return {
    player: world.player,
    playerBullets: world.playerBullets,
    enemyBullets: world.enemyBullets,
    enemies: world.enemies,
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
