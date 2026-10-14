import { describe, expect, it } from 'vitest';
import { HitOutcome, Player, PlayerState } from '../../src/domain/game/player';
import type { PlayerShotSpawner } from '../../src/domain/game/weapon';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';

const DT = 1 / 60;
const FLY_IN_STEPS = 30;
const INVULNERABLE_STEPS = 90;

/** Counts the shots the player's weapon asks for. */
class CountingSpawner implements PlayerShotSpawner {
  shots = 0;
  spawnPlayerBullet(): void {
    this.shots += 1;
  }
}

/** One fixed step as `Run.step` drives it: move and fire at step 2, timers at step 7. */
function step(
  player: Player,
  frame: Readonly<IntentFrame>,
  times = 1,
  spawner: PlayerShotSpawner = new CountingSpawner(),
): void {
  for (let i = 0; i < times; i += 1) {
    player.update(frame, DT, spawner);
    player.advanceTimers();
  }
}

function firing(): IntentFrame {
  const frame = createIntentFrame();
  frame.held = Button.Fire;
  return frame;
}

function idle(): IntentFrame {
  return createIntentFrame();
}

function direction(x: number, y: number): IntentFrame {
  const frame = createIntentFrame();
  frame.moveKind = 'direction';
  frame.moveX = x;
  frame.moveY = y;
  return frame;
}

function target(x: number, y: number): IntentFrame {
  const frame = createIntentFrame();
  frame.moveKind = 'target';
  frame.moveX = x;
  frame.moveY = y;
  return frame;
}

/** A player whose fly-in is over, at its resting point. */
function controllable(): Player {
  const player = new Player();
  step(player, idle(), FLY_IN_STEPS);
  return player;
}

describe('Player — spawn and fly-in (GDD v0.5 §4.1)', () => {
  it('spawns centred, fully hidden below the field, in Entering, with no smear', () => {
    const player = new Player();
    expect(player.state).toBe(PlayerState.Entering);
    expect(player.position).toEqual({ x: 120, y: 336 });
    expect(player.previousPosition).toEqual(player.position);
  });

  it('flies straight up, linearly, and reaches its resting point at the end of the fly-in', () => {
    const player = new Player();
    step(player, idle(), 10);
    expect(player.position.y).toBeCloseTo(336 - 64 / 3, 9); // linear, never clamped to 304
    step(player, idle(), 20);
    expect(player.position).toEqual({ x: 120, y: 272 });
  });

  it('ignores movement during the fly-in', () => {
    const player = new Player();
    step(player, direction(1, 0), FLY_IN_STEPS);
    expect(player.position.x).toBe(120);
  });

  it('becomes Invulnerable after the fly-in, then Vulnerable after the invulnerability', () => {
    const player = new Player();
    step(player, idle(), FLY_IN_STEPS - 1);
    expect(player.state).toBe(PlayerState.Entering);
    step(player, idle());
    expect(player.state).toBe(PlayerState.Invulnerable);
    step(player, idle(), INVULNERABLE_STEPS - 1);
    expect(player.state).toBe(PlayerState.Invulnerable);
    step(player, idle());
    expect(player.state).toBe(PlayerState.Vulnerable);
  });
});

describe('Player — movement (GDD v0.5 §4.1, ADR-0009)', () => {
  it('moves 2.5 px per step at full speed in a direction', () => {
    const player = controllable();
    step(player, direction(-1, 0));
    expect(player.position.x).toBeCloseTo(120 - 2.5, 9);
  });

  it('keeps the previous position of the step for interpolation', () => {
    const player = controllable();
    step(player, direction(-1, 0));
    expect(player.previousPosition.x).toBe(120);
  });

  it('approaches a target at most at the maximum speed, then snaps to it', () => {
    const player = controllable();
    step(player, target(120, 200));
    expect(player.position.y).toBeCloseTo(272 - 2.5, 9);
    const near = target(120 + 1, player.position.y - 1);
    step(player, near);
    expect(player.position).toEqual({ x: near.moveX, y: near.moveY });
  });

  it('never gives a pointer more speed than a key', () => {
    const byKey = controllable();
    const byPointer = controllable();
    step(byKey, direction(0, -1), 10);
    step(byPointer, target(120, -500), 10);
    expect(byPointer.position.y).toBeCloseTo(byKey.position.y, 9);
  });

  it('stays still without movement', () => {
    const player = controllable();
    step(player, idle(), 5);
    expect(player.position).toEqual({ x: 120, y: 272 });
  });

  it.each([
    [-1, 0, 'x', 16],
    [1, 0, 'x', 224],
    [0, -1, 'y', 16],
    [0, 1, 'y', 304],
  ] as const)('keeps the whole sprite in the field (%i, %i → %s = %i)', (dx, dy, axis, bound) => {
    const player = controllable();
    step(player, direction(dx, dy), 200);
    expect(player.position[axis]).toBe(bound);
  });
});

describe('Player — protection count for the blink (GDD v0.5 §4.1)', () => {
  it('counts continuously from the start of the fly-in through the invulnerability', () => {
    const player = new Player();
    expect(player.protectionSteps).toBe(0);
    step(player, idle(), FLY_IN_STEPS + 10);
    expect(player.protectionSteps).toBe(FLY_IN_STEPS + 10);
  });

  it('stops counting once the ship is Vulnerable', () => {
    const player = new Player();
    step(player, idle(), FLY_IN_STEPS + INVULNERABLE_STEPS + 5);
    expect(player.state).toBe(PlayerState.Vulnerable);
    expect(player.protectionSteps).toBe(FLY_IN_STEPS + INVULNERABLE_STEPS);
  });
});

describe('Player — firing (GDD v0.5 §4.1, §4.3)', () => {
  it('never fires during the fly-in', () => {
    const spawner = new CountingSpawner();
    step(new Player(), firing(), FLY_IN_STEPS, spawner);
    expect(spawner.shots).toBe(0);
  });

  it('fires at once on the first step with control', () => {
    const player = controllable();
    const spawner = new CountingSpawner();
    step(player, firing(), 1, spawner);
    expect(spawner.shots).toBe(1);
  });

  it('fires 10 shots per second while fire is held', () => {
    const player = controllable();
    const spawner = new CountingSpawner();
    step(player, firing(), 60, spawner);
    expect(spawner.shots).toBe(10);
  });
});

const RESPAWN_STEPS = 90;

/** A player past its fly-in and invulnerability: hits count. */
function vulnerable(): Player {
  const player = new Player();
  step(player, idle(), FLY_IN_STEPS + INVULNERABLE_STEPS);
  return player;
}

/** A hit as `Run.step` applies it: at step 5, between `update` (2) and `advanceTimers` (7). */
function hitAndStep(player: Player): HitOutcome {
  player.update(idle(), DT, new CountingSpawner());
  const outcome = player.hit();
  player.advanceTimers();
  return outcome;
}

describe('Player — hits, lives and respawn (GDD §4.4, 05-state-player)', () => {
  it('starts with 3 lives, the ship in play included', () => {
    expect(new Player().lives).toBe(3);
  });

  it.each([
    ['Entering', 0],
    ['Invulnerable', FLY_IN_STEPS + 1],
  ])('ignores a hit while %s', (_state, steps) => {
    const player = new Player();
    step(player, idle(), steps);
    expect(player.hit()).toBe(HitOutcome.Ignored);
    expect(player.lives).toBe(3);
  });

  it('dies on a hit while Vulnerable: one life lost, state Dead', () => {
    const player = vulnerable();
    expect(player.hit()).toBe(HitOutcome.Died);
    expect(player.state).toBe(PlayerState.Dead);
    expect(player.lives).toBe(2);
  });

  it('loses at most one life per step: a second hit while Dead is ignored', () => {
    const player = vulnerable();
    player.hit();
    expect(player.hit()).toBe(HitOutcome.Ignored);
    expect(player.lives).toBe(2);
  });

  it('neither moves nor fires while Dead', () => {
    const player = vulnerable();
    hitAndStep(player);
    const where = { ...player.position };
    const spawner = new CountingSpawner();
    const moveAndFire = direction(1, 0);
    moveAndFire.held = Button.Fire;
    step(player, moveAndFire, 10, spawner);
    expect(player.position).toEqual(where);
    expect(spawner.shots).toBe(0);
  });

  it('flies in again 1.5 s after the death, from the spawn point, with no smear', () => {
    const player = vulnerable();
    hitAndStep(player);
    step(player, idle(), RESPAWN_STEPS - 2);
    expect(player.state).toBe(PlayerState.Dead);
    step(player, idle());
    expect(player.state).toBe(PlayerState.Entering);
    expect(player.position).toEqual({ x: 120, y: 336 });
    expect(player.previousPosition).toEqual(player.position);
    expect(player.protectionSteps).toBe(0);
  });

  it('fires on its first controllable step after a respawn, even after dying mid-cooldown', () => {
    const player = vulnerable();
    const spawner = new CountingSpawner();
    step(player, firing(), 1, spawner); // the cooldown starts
    hitAndStep(player);
    step(player, idle(), RESPAWN_STEPS - 1 + FLY_IN_STEPS);
    const after = new CountingSpawner();
    step(player, firing(), 1, after);
    expect(after.shots).toBe(1);
  });

  it('is out only at the end of the last death sequence', () => {
    const player = vulnerable();
    for (let life = 0; life < 2; life += 1) {
      hitAndStep(player);
      step(player, idle(), RESPAWN_STEPS - 1 + FLY_IN_STEPS + INVULNERABLE_STEPS);
    }
    hitAndStep(player);
    expect(player.lives).toBe(0);
    step(player, idle(), RESPAWN_STEPS - 2);
    expect(player.isOut).toBe(false);
    step(player, idle());
    expect(player.isOut).toBe(true);
    expect(player.state).toBe(PlayerState.Dead);
  });
});

describe('Player — a pointer target moves at most one step of reach (GDD v0.5 §4.1, ADR-0009)', () => {
  const REACH = 2.5; // 150 px/s at 60 Hz

  it('moves exactly the reach toward a target farther away, in its direction (3-4-5)', () => {
    const player = controllable();
    step(player, target(120 + 30, 272 - 40)); // 50 px away: 3/5 right, 4/5 up
    expect(player.position.x).toBeCloseTo(120 + 0.6 * REACH, 9);
    expect(player.position.y).toBeCloseTo(272 - 0.8 * REACH, 9);
    expect(Math.hypot(player.position.x - 120, player.position.y - 272)).toBeCloseTo(REACH, 9);
  });

  it.each([
    [-1, 1],
    [1, -1],
    [-1, -1],
  ])('keeps the sign of each axis toward a target at (%i, %i) quadrant', (sx, sy) => {
    const player = controllable();
    step(player, target(120 + sx * 30, 272 + sy * 40));
    expect(Math.sign(player.position.x - 120)).toBe(sx);
    expect(Math.sign(player.position.y - 272)).toBe(sy);
    expect(Math.hypot(player.position.x - 120, player.position.y - 272)).toBeCloseTo(REACH, 9);
  });

  it('lands exactly on a target within the reach, on both axes', () => {
    const player = controllable();
    step(player, target(120 + 1.5, 272 - 2)); // exactly 2.5 px away: the reach itself
    expect(player.position).toEqual({ x: 121.5, y: 270 });
  });

  it('moves the reach, not onto the target, when it is just beyond the reach', () => {
    const player = controllable();
    step(player, target(120 + 1.5, 272 - 2.1)); // about 2.58 px away
    expect(Math.hypot(player.position.x - 120, player.position.y - 272)).toBeCloseTo(REACH, 9);
  });
});

describe('Player — isOut (05-state-player)', () => {
  it('is false for a ship in play and through a death sequence while a life is left', () => {
    const player = vulnerable();
    expect(player.isOut).toBe(false);
    player.hit();
    expect(player.state).toBe(PlayerState.Dead);
    expect(player.lives).toBe(2);
    for (let i = 0; i < RESPAWN_STEPS; i += 1) {
      expect(player.isOut).toBe(false);
      player.advanceTimers();
    }
    expect(player.state).toBe(PlayerState.Entering);
    expect(player.isOut).toBe(false);
  });
});
