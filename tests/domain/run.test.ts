import { describe, expect, it } from 'vitest';
import { Pickup, PickupKind } from '../../src/domain/game/pickup';
import { PlayerState } from '../../src/domain/game/player';
import type { Bullet } from '../../src/domain/game/bullet';
import { DIVER, POPCORN } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { LevelScript } from '../../src/domain/game/level-script';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { ENEMY_POOL_SIZE, PLAYER_BULLET_POOL_SIZE } from '../../src/domain/game/tuning';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { testScript } from '../support/script';

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
    const script: LevelScript = testScript([
      { at: 0, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    ]);
    const run = new Run({ levels: [script] });
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

  it('plays on without the ship after GAME_OVER: the script goes on, the score never moves', () => {
    const script: LevelScript = testScript([
      ...[2, 6.5, 11].map((at) => ({
        at,
        archetype: DIVER,
        count: 1,
        spawn: { x: 120, y: -8 },
      })),
      // Due after the Game over (about 15 s): it spawns only if the run plays on.
      { at: 20, archetype: POPCORN, count: 1, spawn: { x: 40, y: -8 } },
    ]);
    const run = new Run({ levels: [script] });
    for (let i = 0; i < 3000 && run.outcome() === RunOutcome.Playing; i += 1) {
      run.step(DT, frame(0));
    }
    expect(run.outcome()).toBe(RunOutcome.GameOver);
    const snapshot = run.snapshot();
    const before = { ship: JSON.stringify(snapshot.player), score: snapshot.score };
    const fire = frame(Button.Fire, 1);
    for (let i = 0; i < 600; i += 1) run.step(DT, fire);
    expect(JSON.stringify(snapshot.player)).toBe(before.ship);
    expect(snapshot.score).toBe(before.score);
    expect(snapshot.lives).toBe(0);
    expect(snapshot.playerBullets.count).toBe(0);
    expect(run.outcome()).toBe(RunOutcome.GameOver);
    // The 20 s Popcorn spawns only if the run kept stepping after the Game over.
    let popcornSeen = false;
    const run2 = new Run({ levels: [script] });
    for (let i = 0; i < 1500; i += 1) {
      run2.step(DT, frame(0));
      const enemies = run2.snapshot().enemies;
      for (let e = 0; e < enemies.count; e += 1) {
        if (enemies.at(e).archetype === POPCORN)
          popcornSeen = run2.outcome() === RunOutcome.GameOver;
      }
    }
    expect(popcornSeen).toBe(true);
  });
});

describe('Run — scoring (GDD §8, ADR-0010 wording note)', () => {
  it('subscribes its ScoreKeeper first: a later listener already reads the new score', () => {
    const script: LevelScript = testScript([
      { at: 0, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    ]);
    const run = new Run({ levels: [script] });
    let seen = -1;
    run.events().subscribe(GameEventKind.EnemyDestroyed, () => {
      seen = run.snapshot().score;
    });
    for (let i = 0; i < 120 && seen < 0; i += 1) run.step(DT, frame(Button.Fire));
    expect(seen).toBe(150);
    expect(run.snapshot().multiplier).toBe(1);
    expect(run.snapshot().chainRatio).toBeGreaterThan(0);
  });
});

describe('Run — a refused lone enemy', () => {
  it('drops a spawn the full enemy pool refuses, with no formation to complete', () => {
    const rows = Array.from({ length: ENEMY_POOL_SIZE + 1 }, () => ({
      at: 0,
      archetype: POPCORN,
      count: 1,
      spawn: { x: 120, y: -8 },
    }));
    const run = new Run({ levels: [testScript(rows)] });
    let cleared = 0;
    run.events().subscribe(GameEventKind.FormationCleared, () => {
      cleared += 1;
    });
    steps(run, frame(0), 1);
    expect(run.snapshot().enemies.count).toBe(ENEMY_POOL_SIZE);
    expect(cleared).toBe(0);
  });
});

describe('Run — the death release of a lost power level', () => {
  function raisedLaser(): Run {
    const run = new Run();
    const pickup = new Pickup();
    pickup.spawn(PickupKind.PBlue, 100, 200, 1);
    run.rules.pickupCollected(pickup);
    run.rules.pickupCollected(pickup);
    return run;
  }

  it('releases a blue P for a lost Laser level and announces it', () => {
    const run = raisedLaser();
    const heard: number[] = [];
    run.events().subscribe(GameEventKind.PickupSpawned, (e) => heard.push(e.detail));
    run.rules.playerDied();
    expect(heard).toEqual([PickupKind.PBlue]);
  });
});
