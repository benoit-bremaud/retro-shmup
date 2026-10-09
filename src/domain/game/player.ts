import { Button } from '../ports/input-port';
import type { IntentFrame } from '../ports/input-port';
import { FIELD_HEIGHT, FIELD_WIDTH } from './geometry';
import type { Vec2 } from './geometry';
import { PlayerTuning, toSteps } from './tuning';
import { Weapon } from './weapon';
import type { BulletSpawner } from './weapon';

/** Lifecycle of the ship (05-state-player); `Dead` arrives with collisions. */
export const PlayerState = {
  Entering: 'ENTERING',
  Invulnerable: 'INVULNERABLE',
  Vulnerable: 'VULNERABLE',
} as const;
export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

const FLY_IN_STEPS = toSteps(PlayerTuning.flyInSeconds);
const INVULNERABLE_STEPS = toSteps(PlayerTuning.invulnerableSeconds);
const MIN_X = PlayerTuning.halfSize;
const MAX_X = FIELD_WIDTH - PlayerTuning.halfSize;
const MIN_Y = PlayerTuning.halfSize;
const MAX_Y = FIELD_HEIGHT - PlayerTuning.halfSize;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The player's ship (class diagram, view A). `Run.step` calls `update` at step 2 (move) and
 * `advanceTimers` at step 7, so a state change takes effect from the next step, after the
 * collisions of step 5.
 */
export class Player {
  readonly position: Vec2 = { x: PlayerTuning.spawnX, y: PlayerTuning.spawnY };
  readonly previousPosition: Vec2 = { x: PlayerTuning.spawnX, y: PlayerTuning.spawnY };
  private readonly weapon = new Weapon();
  private currentState: PlayerState = PlayerState.Entering;
  /** Steps left in the current timed state (05-state-player: one timer). */
  private stateSteps = FLY_IN_STEPS;
  /** Steps since the protection began; the blink phase comes from it, never from `stateSteps`. */
  private protection = 0;

  get state(): PlayerState {
    return this.currentState;
  }

  get protectionSteps(): number {
    return this.protection;
  }

  /**
   * Step 2 of `Run.step`: the fly-in, or the movement the frame asks for and the weapon. The
   * spawner is a parameter, as for the enemies' attack patterns: the player never stores it.
   */
  update(frame: Readonly<IntentFrame>, dt: number, spawner: BulletSpawner): void {
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;
    if (this.currentState === PlayerState.Entering) {
      this.flyIn();
      return;
    }
    this.move(frame, dt);
    this.position.x = clamp(this.position.x, MIN_X, MAX_X);
    this.position.y = clamp(this.position.y, MIN_Y, MAX_Y);
    this.weapon.tick(this.position, (frame.held & Button.Fire) !== 0, spawner);
  }

  /** Step 7 of `Run.step`: the state timer and the protection count. */
  advanceTimers(): void {
    if (this.currentState === PlayerState.Vulnerable) return;
    this.protection += 1;
    this.stateSteps -= 1;
    if (this.stateSteps > 0) return;
    if (this.currentState === PlayerState.Entering) {
      this.currentState = PlayerState.Invulnerable;
      this.stateSteps = INVULNERABLE_STEPS;
    } else {
      this.currentState = PlayerState.Vulnerable;
    }
  }

  // Linear from the spawn point to the resting point over the fly-in steps.
  private flyIn(): void {
    const done = FLY_IN_STEPS - this.stateSteps + 1;
    const travel = PlayerTuning.restY - PlayerTuning.spawnY;
    this.position.y = PlayerTuning.spawnY + (travel * done) / FLY_IN_STEPS;
  }

  private move(frame: Readonly<IntentFrame>, dt: number): void {
    const reach = PlayerTuning.maxSpeed * dt;
    if (frame.moveKind === 'direction') {
      this.position.x += frame.moveX * reach;
      this.position.y += frame.moveY * reach;
    } else if (frame.moveKind === 'target') {
      const dx = frame.moveX - this.position.x;
      const dy = frame.moveY - this.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= reach) {
        this.position.x = frame.moveX;
        this.position.y = frame.moveY;
      } else {
        this.position.x += (dx / distance) * reach;
        this.position.y += (dy / distance) * reach;
      }
    }
  }
}
