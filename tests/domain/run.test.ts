import { describe, expect, it } from 'vitest';
import { PlayerState } from '../../src/domain/game/player';
import type { Bullet } from '../../src/domain/game/bullet';
import { DIVER } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { LevelScript } from '../../src/domain/game/level-script';
import { Run, RunOutcome } from '../../src/domain/game/run';
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
    expect(snapshot.playerBullets.count).toBe(1);
    expect(snapshot.playerBullets.at(0).position.y).toBeCloseTo(256 - 6, 9);
    expect(snapshot.playerBullets.at(0).previousPosition.y).toBe(256);
  });

  it('releases bullets that leave the field, so a held fire never exhausts the pool', () => {
    const run = new Run();
    steps(run, frame(Button.Fire), FLY_IN_STEPS + 600);
    expect(run.snapshot().playerBullets.count).toBeLessThan(PLAYER_BULLET_POOL_SIZE);
    expect(run.snapshot().playerBullets.count).toBeGreaterThan(0);
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
      const { player, playerBullets } = run.snapshot();
      expect(playerBullets.count).toBeGreaterThan(0);
      const bullets: Readonly<Bullet>[] = [];
      for (let i = 0; i < playerBullets.count; i += 1) bullets.push(playerBullets.at(i));
      return JSON.stringify({ player, bullets });
    };
    expect(play()).toBe(play());
  });
});

describe('Run — events of the enemies brick (ADR-0010, enemy-destroyed sequence)', () => {
  it('publishes ENEMY_HIT, then one ENEMY_DESTROYED carrying position, score and size tier', () => {
    const script: LevelScript = {
      events: [{ at: 0, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } }],
    };
    const run = new Run(script);
    const log: string[] = [];
    run.events().subscribe(GameEventKind.EnemyHit, (e) => log.push(`hit ${String(e.subject)}`));
    run
      .events()
      .subscribe(GameEventKind.EnemyDestroyed, (e) =>
        log.push(`destroyed ${String(e.value)} ${String(e.detail)} ${String(e.position.x)}`),
      );
    for (let i = 0; i < 120 && log.length < 2; i += 1) run.step(DT, frame(Button.Fire));
    expect(log).toEqual(['hit 1', 'destroyed 150 0 120']);
  });

  it('stops stepping once the outcome is GAME_OVER', () => {
    const script: LevelScript = {
      events: [2, 6.5, 11].map((at) => ({
        at,
        archetype: DIVER,
        count: 1,
        spawn: { x: 120, y: -8 },
      })),
    };
    const run = new Run(script);
    for (let i = 0; i < 3000 && run.outcome() === RunOutcome.Playing; i += 1) {
      run.step(DT, frame(0));
    }
    expect(run.outcome()).toBe(RunOutcome.GameOver);
    const before = JSON.stringify(run.snapshot().player);
    run.step(DT, frame(0, 1));
    expect(JSON.stringify(run.snapshot().player)).toBe(before);
  });
});
