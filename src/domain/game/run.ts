import type { IntentFrame } from '../ports/input-port';
import type { Bullet } from './bullet';
import type { Vec2 } from './geometry';
import type { PlayerState } from './player';
import { World } from './world';

/** How a run stands after a step (class diagram); only `PLAYING` exists before enemies. */
export const RunOutcome = {
  Playing: 'PLAYING',
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
 * it reads the live objects of the run.
 */
export interface WorldSnapshot {
  readonly player: PlayerSnapshot;
  /** The live pool list: only the first `playerBulletCount` entries are active. */
  readonly playerBullets: readonly Readonly<Bullet>[];
  readonly playerBulletCount: number;
}

/**
 * The simulation of one run (class diagram: `Simulation`, `RunView`). `step` follows the fixed
 * order of the class diagram; the slots of later bricks (level script, bomb, collisions) are
 * empty until their brick lands.
 */
export class Run {
  private readonly world = new World();
  private readonly snapshotView: WorldSnapshot = createSnapshot(this.world);

  /** One fixed step; `dt` is in seconds (ADR-0014). */
  step(dt: number, frame: Readonly<IntentFrame>): void {
    // (2) the player moves and its weapon fires.
    this.world.player.update(frame, dt, this.world);
    // (4) bullets move.
    this.world.moveBullets(dt);
    // (6) bodies leaving the screen are released.
    this.world.releaseOffscreen();
    // (7) timers advance. (8) the outcome stays PLAYING until enemies exist.
    this.world.player.advanceTimers();
  }

  outcome(): RunOutcome {
    return RunOutcome.Playing;
  }

  snapshot(): WorldSnapshot {
    return this.snapshotView;
  }
}

function createSnapshot(world: World): WorldSnapshot {
  return {
    player: world.player,
    playerBullets: world.playerBullets,
    get playerBulletCount(): number {
      return world.playerBulletCount;
    },
  };
}
