import { describe, expect, it } from 'vitest';
import { Player, PlayerState } from '../../src/domain/game/player';
import { PlayerTuning } from '../../src/domain/game/tuning';
import { createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';

const DT = 1 / 60;
const FLY_IN_STEPS = 30;
const INVULNERABLE_STEPS = 90;

/** One fixed step as `Run.step` drives it: move at step 2, timers at step 7. */
function step(player: Player, frame: Readonly<IntentFrame>, times = 1): void {
  for (let i = 0; i < times; i += 1) {
    player.update(frame, DT);
    player.advanceTimers();
  }
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
    expect(player.position).toEqual({ x: PlayerTuning.spawnX, y: PlayerTuning.spawnY });
    expect(player.previousPosition).toEqual(player.position);
  });

  it('flies straight up, linearly, and reaches its resting point at the end of the fly-in', () => {
    const player = new Player();
    step(player, idle(), FLY_IN_STEPS / 2);
    expect(player.position.y).toBeCloseTo((PlayerTuning.spawnY + PlayerTuning.restY) / 2, 9);
    step(player, idle(), FLY_IN_STEPS / 2);
    expect(player.position).toEqual({ x: PlayerTuning.spawnX, y: PlayerTuning.restY });
  });

  it('ignores movement during the fly-in', () => {
    const player = new Player();
    step(player, direction(1, 0), FLY_IN_STEPS);
    expect(player.position.x).toBe(PlayerTuning.spawnX);
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
    expect(player.position.x).toBeCloseTo(PlayerTuning.spawnX - 2.5, 9);
  });

  it('keeps the previous position of the step for interpolation', () => {
    const player = controllable();
    step(player, direction(-1, 0));
    expect(player.previousPosition.x).toBe(PlayerTuning.spawnX);
  });

  it('approaches a target at most at the maximum speed, then snaps to it', () => {
    const player = controllable();
    step(player, target(PlayerTuning.spawnX, 200));
    expect(player.position.y).toBeCloseTo(PlayerTuning.restY - 2.5, 9);
    const near = target(PlayerTuning.spawnX + 1, player.position.y - 1);
    step(player, near);
    expect(player.position).toEqual({ x: near.moveX, y: near.moveY });
  });

  it('never gives a pointer more speed than a key', () => {
    const byKey = controllable();
    const byPointer = controllable();
    step(byKey, direction(0, -1), 10);
    step(byPointer, target(PlayerTuning.spawnX, -500), 10);
    expect(byPointer.position.y).toBeCloseTo(byKey.position.y, 9);
  });

  it('stays still without movement', () => {
    const player = controllable();
    step(player, idle(), 5);
    expect(player.position).toEqual({ x: PlayerTuning.spawnX, y: PlayerTuning.restY });
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
