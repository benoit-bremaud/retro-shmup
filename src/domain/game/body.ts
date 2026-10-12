import type { Vec2 } from './geometry';

/**
 * The movable, damageable state the stateless strategies drive (class diagram, view B). Per-enemy
 * scratch state lives here, so archetypes are shared data and nothing is allocated per spawn.
 * Positions are centres in play-field pixels; velocities are pixels per second.
 */
export interface Body {
  readonly serial: number;
  readonly position: Vec2;
  readonly previousPosition: Vec2;
  readonly velocity: Vec2;
  /** Where the script spawned it (for the S curve: x0 is the curve's axis). */
  readonly origin: Vec2;
  /** Where a Gunner stops; unused by the other movements. */
  readonly hover: Vec2;
  /** Where a Diver aims, captured at the start of its dive. */
  readonly diveTarget: Vec2;
  width: number;
  height: number;
  hp: number;
  /**
   * Steps since the current movement began, incremented before the movement (ADR-0023). For an
   * enemy and a pickup that is the steps since the spawn; for the boss it restarts at the start
   * of the fight and at each movement swap, so a closed-form movement such as the sway reads it
   * as its own clock.
   */
  age: number;
  fireTimer: number;
  /**
   * Volleys fired, one counter per pattern of the attack (ADR-0022): index 0 for a single pattern.
   * A fixed pair, reset on spawn, so nothing is allocated per spawn.
   */
  readonly volleys: [number, number];
  mirror: boolean;
  /** Has overlapped the field once: only then does leaving it despawn the body. */
  entered: boolean;
  /** Set by the movement while the attack may fire (a Gunner's hold). */
  armed: boolean;
  /** Destroyed this step: skipped by every pass, released at step 6. */
  spent: boolean;
}

/**
 * Applies a hit's damage. True only on the step the body's HP crosses to 0 or below, so the shot
 * and bomb paths destroy a body at most once (class diagram notes, damage).
 */
export function applyDamage(body: Body, amount: number): boolean {
  if (body.hp <= 0) return false;
  body.hp -= amount;
  return body.hp <= 0;
}
