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
      if (!volleyDue(self, period)) return;
      self.volleys[0] += 1;
      aimVelocity(aim, self.position, world.playerPosition(), speed);
      spawn.spawnEnemyBullet(self.position.x, self.position.y, aim.x, aim.y);
    },
  });
}

/**
 * Arms the period timer of a volley attack: full while disarmed, so the first volley comes
 * `period` steps into the hold. True on the step a volley is due.
 */
function volleyDue(self: Body, period: number): boolean {
  if (!self.armed) {
    self.fireTimer = period;
    return false;
  }
  self.fireTimer -= 1;
  if (self.fireTimer > 0) return false;
  self.fireTimer = period;
  return true;
}

const RADIANS_PER_DEGREE = Math.PI / 180;

/** The configuration of a ring (ADR-0022): `count` bullets evenly spaced, the first straight down. */
export interface RingAttackConfig {
  readonly count: number;
  readonly periodS: number;
  /** Pixels per second. */
  readonly speed: number;
  /** The whole ring turns by this many degrees per volley fired (`Body.volleys[0]`). */
  readonly rotateDeg: number;
}

/**
 * A ring of `count` bullets every `periodS` while armed (GDD v0.10 §5.2.1): its first bullet
 * points straight down, turned by `rotateDeg` × the volleys already fired — with 12 bullets 30°
 * apart and 15°, every other volley is the turned ring. The bullets' unit vectors are computed at
 * load; a volley rotates them by one angle, so nothing is allocated.
 */
export function ringAttack(config: Readonly<RingAttackConfig>): AttackPattern {
  const period = toSteps(config.periodS);
  const { count, speed } = config;
  const rotate = config.rotateDeg * RADIANS_PER_DEGREE;
  const ux = new Float64Array(count);
  const uy = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / count;
    ux[i] = Math.sin(angle);
    uy[i] = Math.cos(angle);
  }
  return Object.freeze({
    tick(self: Body, _world: WorldView, spawn: EnemyShotSpawner): void {
      if (!volleyDue(self, period)) return;
      const turn = rotate * self.volleys[0];
      self.volleys[0] += 1;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      for (let i = 0; i < count; i += 1) {
        const x = ux[i] ?? 0;
        const y = uy[i] ?? 0;
        // Angles grow from straight down towards +x: (sin θ, cos θ) turned by `turn`.
        const vx = x * cos + y * sin;
        const vy = y * cos - x * sin;
        spawn.spawnEnemyBullet(self.position.x, self.position.y, vx * speed, vy * speed);
      }
    },
  });
}

/** The configuration of a fan (ADR-0022): `count` bullets `spreadDeg` apart, centred on the aim. */
export interface FanAttackConfig {
  readonly count: number;
  readonly spreadDeg: number;
  readonly periodS: number;
  /** Pixels per second. */
  readonly speed: number;
}

/**
 * A fan of `count` bullets `spreadDeg` apart every `periodS` while armed, centred on the aim at
 * the ship (GDD v0.10 §5.2.1); straight down when the ship is exactly on the body. The offsets'
 * cosines and sines are computed at load, so nothing is allocated.
 */
export function fanAttack(config: Readonly<FanAttackConfig>): AttackPattern {
  const period = toSteps(config.periodS);
  const { count, speed } = config;
  const cosines = new Float64Array(count);
  const sines = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * config.spreadDeg * RADIANS_PER_DEGREE;
    cosines[i] = Math.cos(offset);
    sines[i] = Math.sin(offset);
  }
  return Object.freeze({
    tick(self: Body, world: WorldView, spawn: EnemyShotSpawner): void {
      if (!volleyDue(self, period)) return;
      // Every pattern counts its volleys (ADR-0022), though a fan never turns.
      self.volleys[0] += 1;
      aimVelocity(aim, self.position, world.playerPosition(), 1);
      for (let i = 0; i < count; i += 1) {
        const cos = cosines[i] ?? 1;
        const sin = sines[i] ?? 0;
        const vx = aim.x * cos + aim.y * sin;
        const vy = aim.y * cos - aim.x * sin;
        spawn.spawnEnemyBullet(self.position.x, self.position.y, vx * speed, vy * speed);
      }
    },
  });
}
