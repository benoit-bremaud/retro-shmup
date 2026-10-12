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

/**
 * Fires for a body (ADR-0003: stateless strategy, ADR-0023: `fire` and `tick`). `fire` is one
 * volley for the given volley `count`, with no timing and no read of `Body.volleys`, so a
 * `sequenceAttack` can call it on its own timer. `tick` is the timed wrapper: it waits for
 * `fireTimer`, calls `fire` with `volleys[0]` and counts the volley.
 */
export interface AttackPattern {
  fire(self: Body, world: WorldView, spawn: EnemyShotSpawner, count: number): void;
  tick(self: Body, world: WorldView, spawn: EnemyShotSpawner, dt: number): void;
}

/** Popcorn and Diver: contact only (a Null Object, no branch at the call site). */
export const NoAttack: AttackPattern = {
  fire(): void {
    // Never fires.
  },
  tick(): void {
    // Never fires.
  },
};

type VolleyFire = AttackPattern['fire'];

/**
 * Wraps a `fire` in the timed `tick` of a single-period attack: the volley count handed to `fire`
 * is the body's `volleys[0]`, counted from 0. Built at load.
 */
function timedAttack(period: number, fire: VolleyFire): AttackPattern {
  return Object.freeze({
    fire,
    tick(self: Body, world: WorldView, spawn: EnemyShotSpawner): void {
      if (!volleyDue(self, period)) return;
      const count = self.volleys[0];
      self.volleys[0] += 1;
      fire(self, world, spawn, count);
    },
  });
}

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
  return timedAttack(period, (self, world, spawn) => {
    aimVelocity(aim, self.position, world.playerPosition(), speed);
    spawn.spawnEnemyBullet(self.position.x, self.position.y, aim.x, aim.y);
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
  return timedAttack(period, (self, _world, spawn, volley) => {
    const turn = rotate * volley;
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
  return timedAttack(period, (self, world, spawn) => {
    aimVelocity(aim, self.position, world.playerPosition(), 1);
    for (let i = 0; i < count; i += 1) {
      const cos = cosines[i] ?? 1;
      const sin = sines[i] ?? 0;
      const vx = aim.x * cos + aim.y * sin;
      const vy = aim.y * cos - aim.x * sin;
      spawn.spawnEnemyBullet(self.position.x, self.position.y, vx * speed, vy * speed);
    }
  });
}

/**
 * Alternates attack groups on one timer (ADR-0023): one volley every `periodS` while armed, the
 * first `periodS` into the hold. Volley *i* fires every pattern of group *i* mod *n* through its
 * `fire`, all with the count *i* (`Body.volleys[0]`, from 0); the inner patterns' own `periodS`
 * is ignored. The Cruiser's phase 1 is `[[fan], [ring]]` and its phase 2 `[[ring], [ring, triple]]`.
 * Built once at load; a pattern that needs a period of its own would need `parallelAttack`.
 */
export function sequenceAttack(
  groups: readonly (readonly AttackPattern[])[],
  periodS: number,
): AttackPattern {
  if (groups.length === 0) throw new RangeError('sequenceAttack: needs at least one group');
  const frozen: (readonly AttackPattern[])[] = [];
  for (let i = 0; i < groups.length; i += 1) frozen.push(Object.freeze((groups[i] ?? []).slice()));
  return timedAttack(toSteps(periodS), (self, world, spawn, count) => {
    const group = frozen[count % frozen.length] ?? [];
    for (let i = 0; i < group.length; i += 1) group[i]?.fire(self, world, spawn, count);
  });
}
