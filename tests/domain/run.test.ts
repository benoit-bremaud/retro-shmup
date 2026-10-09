import { describe, expect, it } from 'vitest';
import { PlayerState } from '../../src/domain/game/player';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { PlayerTuning, SpreadLevel1 } from '../../src/domain/game/tuning';
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
  it('stays PLAYING: nothing ends a run before enemies exist', () => {
    const run = new Run();
    steps(run, frame(Button.Fire), 200);
    expect(run.outcome()).toBe(RunOutcome.Playing);
  });

  it('moves a bullet in the step it is born: spawned at step 2, moved at step 4', () => {
    const run = new Run();
    steps(run, frame(0), FLY_IN_STEPS);
    run.step(DT, frame(Button.Fire));
    const snapshot = run.snapshot();
    const nose = PlayerTuning.restY - SpreadLevel1.noseOffset;
    expect(snapshot.playerBulletCount).toBe(1);
    expect(snapshot.playerBullets[0]?.position.y).toBeCloseTo(nose - SpreadLevel1.speed * DT, 9);
    expect(snapshot.playerBullets[0]?.previousPosition.y).toBe(nose);
  });

  it('releases bullets that leave the field, so a held fire never exhausts the pool', () => {
    const run = new Run();
    steps(run, frame(Button.Fire), FLY_IN_STEPS + 600);
    expect(run.snapshot().playerBulletCount).toBeLessThan(16);
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
      frame(i % 7 < 4 ? Button.Fire : 0, i % 50 < 25 ? 1 : -1, i % 30 < 10 ? -1 : 0);
    const first = new Run();
    const second = new Run();
    for (let i = 0; i < 400; i += 1) {
      first.step(DT, script(i));
      second.step(DT, script(i));
    }
    const a = first.snapshot();
    const b = second.snapshot();
    expect(b.player.position).toEqual(a.player.position);
    expect(b.playerBulletCount).toBe(a.playerBulletCount);
    for (let i = 0; i < a.playerBulletCount; i += 1) {
      expect(b.playerBullets[i]?.position).toEqual(a.playerBullets[i]?.position);
    }
  });
});
