import type { Body } from './body';
import { aimVelocity } from './movements';
import type { WorldView } from './movements';
import { toSteps } from './tuning';

/**
 * Where enemy attacks put their bullets (class diagram). Declared with the attack patterns, its
 * clients, so an attack can never fire a player bullet (ADR-0003 wording note).
 */
export interface EnemyShotSpawner {
  spawnEnemyBullet(x: number, y: number, vxPerSecond: number, vyPerSecond: number): void;
}

/** Fires for a body one step (ADR-0003: stateless strategy). */
export interface AttackPattern {
  tick(self: Body, world: WorldView, spawn: EnemyShotSpawner, dt: number): void;
}

/** Popcorn and Diver: contact only (a Null Object, no branch at the call site). */
export const NoAttack: AttackPattern = {
  tick(): void {
    // Never fires.
  },
};

// Scratch velocity of the shot being fired: written then read at once, never kept.
const aim = { x: 0, y: 0 };

/** The configuration of an aimed attack (ADR-0022). */
export interface AimedAttackConfig {
  readonly periodS: number;
  /** Pixels per second. */
  readonly speed: number;
}

/**
 * One bullet aimed at the ship every `periodS` while armed (GDD v0.6 §5.2.1): the timer stays
 * full while disarmed, so the first shot comes `periodS` into the hold. Built once at load.
 */
export function aimedAttack(config: Readonly<AimedAttackConfig>): AttackPattern {
  const period = toSteps(config.periodS);
  const speed = config.speed;
  return Object.freeze({
    tick(self: Body, world: WorldView, spawn: EnemyShotSpawner): void {
      if (!self.armed) {
        self.fireTimer = period;
        return;
      }
      self.fireTimer -= 1;
      if (self.fireTimer > 0) return;
      self.fireTimer = period;
      aimVelocity(aim, self.position, world.playerPosition(), speed);
      spawn.spawnEnemyBullet(self.position.x, self.position.y, aim.x, aim.y);
    },
  });
}
