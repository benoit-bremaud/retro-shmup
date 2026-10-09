import { describe, expect, it } from 'vitest';
import { PlayerState } from '../../src/domain/game/player';
import { Run } from '../../src/domain/game/run';
import { PLAYER_BULLET_POOL_SIZE } from '../../src/domain/game/tuning';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';

const DT = 1 / 60;
const FLY_IN_STEPS = 30;

function frame(held: number, moveX = 0, moveY = 0): IntentFrame {
  const f = createIntentFrame();
  f.held = held;
  if (moveX !== 0 || moveY !== 0) {
    f.moveKind = 'direction';
    f.moveX = moveX;
    f.moveY = moveY;
  }
  return f;
}

function steps(run: Run, f: Readonly<IntentFrame>, times: number): void {
  for (let i = 0; i < times; i += 1) run.step(DT, f);
}

describe('Run — fixed step order (class diagram notes)', () => {
  it('moves a bullet in the step it is born: spawned at step 2, moved at step 4', () => {
    const run = new Run();
    steps(run, frame(0), FLY_IN_STEPS);
    run.step(DT, frame(Button.Fire));
    const snapshot = run.snapshot();
    expect(snapshot.playerBulletCount).toBe(1);
    expect(snapshot.playerBullets[0]?.position.y).toBeCloseTo(256 - 6, 9);
    expect(snapshot.playerBullets[0]?.previousPosition.y).toBe(256);
  });

  it('releases bullets that leave the field, so a held fire never exhausts the pool', () => {
    const run = new Run();
    steps(run, frame(Button.Fire), FLY_IN_STEPS + 600);
    expect(run.snapshot().playerBulletCount).toBeLessThan(PLAYER_BULLET_POOL_SIZE);
    expect(run.snapshot().playerBulletCount).toBeGreaterThan(0);
  });

  it('exposes the ship to the presenter through the snapshot', () => {
    const run = new Run();
    steps(run, frame(0), FLY_IN_STEPS + 1);
    const ship = run.snapshot().player;
    expect(ship.state).toBe(PlayerState.Invulnerable);
    expect(ship.protectionSteps).toBe(FLY_IN_STEPS + 1);
  });

  it('replays identically from the same scripted inputs (ADR-0002)', () => {
    const script = (i: number): IntentFrame =>
      frame(i % 7 < 4 ? Button.Fire : 0, i % 50 < 25 ? 1 : -1, i % 60 < 5 ? -1 : 0);
    const play = (): string => {
      const run = new Run();
      for (let i = 0; i < 400; i += 1) run.step(DT, script(i));
      const { player, playerBullets, playerBulletCount } = run.snapshot();
      expect(playerBulletCount).toBeGreaterThan(0);
      return JSON.stringify({
        player,
        bullets: playerBullets.slice(0, playerBulletCount),
      });
    };
    expect(play()).toBe(play());
  });
});
