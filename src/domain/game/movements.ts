import type { Body } from './body';
import type { Vec2 } from './geometry';
import { DiverTuning, GunnerTuning, PopcornTuning, STEPS_PER_SECOND, toSteps } from './tuning';

/** What a strategy may read of the world (class diagram): the ship's position. */
export interface WorldView {
  playerPosition(): Readonly<Vec2>;
}

/** Moves a body one step (ADR-0003: stateless strategy, configuration only). */
export interface MovementPattern {
  tick(self: Body, world: WorldView, dt: number): void;
}

/**
 * Points `velocity` from `from` to `to` at `speed` px/s; straight down when the two points meet
 * (GDD v0.6 §5.2.1: a zero aim vector never yields NaN). Writes in place: no allocation.
 */
export function aimVelocity(
  velocity: Vec2,
  from: Readonly<Vec2>,
  to: Readonly<Vec2>,
  speed: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) {
    velocity.x = 0;
    velocity.y = speed;
    return;
  }
  velocity.x = (dx / distance) * speed;
  velocity.y = (dy / distance) * speed;
}

const TAU = 2 * Math.PI;

/**
 * The Popcorn S curve (GDD v0.6 §5.2.1): down at a constant speed, the x offset a sine of y around
 * the axis x0; mirrored, the offset is negated. A closed form of the age, so it never drifts.
 */
export const PathMovement: MovementPattern = {
  tick(self: Body): void {
    const y = self.origin.y + (PopcornTuning.speed * self.age) / STEPS_PER_SECOND;
    const offset = PopcornTuning.amplitude * Math.sin((TAU * y) / PopcornTuning.wavelength);
    self.position.x = self.origin.x + (self.mirror ? -offset : offset);
    self.position.y = y;
  },
};

const DIVE_AT = toSteps(DiverTuning.entrySeconds);

/**
 * The Diver (GDD v0.6 §5.2.1): enters straight down, then at the end of its entry captures where
 * the ship is and dives there in a straight line, keeping that heading until it leaves the field.
 */
export const DiveMovement: MovementPattern = {
  tick(self: Body, world: WorldView, dt: number): void {
    if (self.age <= DIVE_AT) {
      self.position.x = self.origin.x;
      self.position.y = self.origin.y + (DiverTuning.entrySpeed * self.age) / STEPS_PER_SECOND;
      if (self.age === DIVE_AT) {
        const ship = world.playerPosition();
        self.diveTarget.x = ship.x;
        self.diveTarget.y = ship.y;
        aimVelocity(self.velocity, self.position, self.diveTarget, DiverTuning.diveSpeed);
      }
      return;
    }
    self.position.x += self.velocity.x * dt;
    self.position.y += self.velocity.y * dt;
  },
};

const TRAVEL_STEPS = toSteps(GunnerTuning.travelSeconds);
const LEAVE_AT = TRAVEL_STEPS + toSteps(GunnerTuning.holdSeconds);

/**
 * The Gunner (GDD v0.6 §5.2.1): a straight line from its spawn point to its hover point, a hold
 * during which it is armed, then back the way it came until it leaves the field.
 */
export const EnterHoldLeave: MovementPattern = {
  tick(self: Body, _world: WorldView, dt: number): void {
    if (self.age <= TRAVEL_STEPS) {
      const t = self.age / TRAVEL_STEPS;
      self.position.x = self.origin.x + (self.hover.x - self.origin.x) * t;
      self.position.y = self.origin.y + (self.hover.y - self.origin.y) * t;
      self.armed = false;
      return;
    }
    if (self.age <= LEAVE_AT) {
      self.position.x = self.hover.x;
      self.position.y = self.hover.y;
      self.armed = true;
      return;
    }
    if (self.armed) {
      self.armed = false;
      aimVelocity(self.velocity, self.hover, self.origin, GunnerTuning.leaveSpeed);
    }
    self.position.x += self.velocity.x * dt;
    self.position.y += self.velocity.y * dt;
  },
};
