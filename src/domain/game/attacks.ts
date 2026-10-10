import type { Body } from './body';
import { aimVelocity } from './movements';
import type { WorldView } from './movements';
import { EnemyBulletTuning, GunnerTuning, toSteps } from './tuning';

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

const FIRE_PERIOD = toSteps(GunnerTuning.firePeriodSeconds);
// Scratch velocity of the shot being fired: written then read at once, never kept.
const aim = { x: 0, y: 0 };

/**
 * One aimed bullet every 1.5 s while armed (GDD v0.6 §5.2.1): the timer stays full while
 * disarmed, so the first shot comes 1.5 s into the hold — 2 bullets per 3.5 s hold.
 */
export const AimedAttack: AttackPattern = {
  tick(self: Body, world: WorldView, spawn: EnemyShotSpawner): void {
    if (!self.armed) {
      self.fireTimer = FIRE_PERIOD;
      return;
    }
    self.fireTimer -= 1;
    if (self.fireTimer > 0) return;
    self.fireTimer = FIRE_PERIOD;
    aimVelocity(aim, self.position, world.playerPosition(), EnemyBulletTuning.speed);
    spawn.spawnEnemyBullet(self.position.x, self.position.y, aim.x, aim.y);
  },
};
