import { describe, expect, it } from 'vitest';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import { PickupKind } from '../../src/domain/game/pickup';
import { Run, RunOutcome } from '../../src/domain/game/run';
import {
  ENEMY_BULLET_POOL_SIZE,
  ENEMY_POOL_SIZE,
  PICKUP_POOL_SIZE,
} from '../../src/domain/game/tuning';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import { RunPresenter } from '../../src/domain/presentation/run-presenter';
import { RecordingRender } from '../support/recording-render';
import type { IntentFrame } from '../../src/domain/ports/input-port';

// Headless level simulation (ADR-0002, ADR-0003): the real run, scripted inputs, no browser.
const DT = 1 / 60;
const ONE_PASS = 2700; // the interim script loops at 45 s
const frame = createIntentFrame();

/** A weaving player who fires most of the time: same index, same frame. */
function scripted(i: number): IntentFrame {
  frame.moveKind = 'direction';
  frame.moveX = Math.floor(i / 90) % 2 === 0 ? 1 : -1;
  frame.moveY = i % 240 < 120 ? -0.5 : 0.5;
  frame.held = i % 10 < 8 ? Button.Fire : 0;
  frame.pressed = 0;
  return frame;
}

function idle(): IntentFrame {
  frame.moveKind = 'none';
  frame.moveX = 0;
  frame.moveY = 0;
  frame.held = 0;
  return frame;
}

/** Plays a run from `seed` and returns its event log and final state as JSON (ADR-0019). */
function replay(steps: number, seed = 1): string {
  const run = new Run({ seed });
  const log: string[] = [];
  const record = (event: Readonly<GameEvent>): void => {
    log.push(`${String(event.kind)}:${String(event.subject)}:${event.position.x.toFixed(3)}`);
  };
  const events = run.events();
  events.subscribe(GameEventKind.EnemyHit, record);
  events.subscribe(GameEventKind.EnemyDestroyed, record);
  events.subscribe(GameEventKind.PlayerDied, record);
  const recordPickup = (event: Readonly<GameEvent>): void => {
    log.push(`${String(event.kind)}:${String(event.detail)}:${String(event.value)}`);
  };
  events.subscribe(GameEventKind.PickupSpawned, recordPickup);
  events.subscribe(GameEventKind.PickupCollected, recordPickup);
  events.subscribe(GameEventKind.FormationCleared, record);
  for (let i = 0; i < steps; i += 1) run.step(DT, scripted(i));
  const snapshot = run.snapshot();
  return JSON.stringify({
    log,
    lives: snapshot.lives,
    outcome: run.outcome(),
    ship: snapshot.player,
  });
}

describe('Level simulation — the enemies brick, headless', () => {
  it('replays identically from the same seed and scripted inputs over three loops', () => {
    const first = replay(3 * ONE_PASS);
    expect(first).toBe(replay(3 * ONE_PASS));
    expect(first).toContain(`"${String(GameEventKind.EnemyDestroyed)}:`);
    expect(first).toContain(`"${String(GameEventKind.PickupSpawned)}:`);
    // The Carriers' cargo is in the log, so the pickup-peak test below covers it.
    expect(first).toContain(
      `"${String(GameEventKind.PickupSpawned)}:${String(PickupKind.Shield)}:`,
    );
    expect(first).toContain(`"${String(GameEventKind.PickupSpawned)}:${String(PickupKind.Bomb)}:`);
  });

  it('lets the seed change the drops (ADR-0019)', () => {
    const logs = new Set<string>();
    for (let seed = 1; seed <= 6; seed += 1) logs.add(replay(3 * ONE_PASS, seed));
    expect(logs.size).toBeGreaterThan(1);
  });

  it("never fills the pickup pool with the script's own drops (GDD v0.8 §4.6)", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const run = new Run({ seed });
      let most = 0;
      for (let i = 0; i < 3 * ONE_PASS; i += 1) {
        run.step(DT, scripted(i));
        most = Math.max(most, run.snapshot().pickups.count);
      }
      expect(most).toBeLessThan(PICKUP_POOL_SIZE);
    }
  });

  it('kills an idle ship three times, then ends the run with Game over', () => {
    const run = new Run();
    let deaths = 0;
    run.events().subscribe(GameEventKind.PlayerDied, () => {
      deaths += 1;
    });
    for (let i = 0; i < 6 * ONE_PASS && run.outcome() === RunOutcome.Playing; i += 1) {
      run.step(DT, idle());
    }
    expect(deaths).toBe(3);
    expect(run.outcome()).toBe(RunOutcome.GameOver);
    expect(run.snapshot().lives).toBe(0);
  });

  it('never fills a pool (no spawn refused), and enemy bullets peak at 40 or fewer', () => {
    const run = new Run();
    let peakEnemies = 0;
    let peakBullets = 0;
    for (let i = 0; i < 3 * ONE_PASS; i += 1) {
      run.step(DT, scripted(i));
      const snapshot = run.snapshot();
      peakEnemies = Math.max(peakEnemies, snapshot.enemies.count);
      peakBullets = Math.max(peakBullets, snapshot.enemyBullets.count);
    }
    expect(peakEnemies).toBeLessThan(ENEMY_POOL_SIZE);
    expect(peakBullets).toBeLessThan(ENEMY_BULLET_POOL_SIZE);
    expect(peakBullets).toBeLessThanOrEqual(40);
  });

  it('scores nothing for enemies that leave the field alive', () => {
    const run = new Run();
    let destroyed = 0;
    run.events().subscribe(GameEventKind.EnemyDestroyed, () => {
      destroyed += 1;
    });
    for (let i = 0; i < ONE_PASS; i += 1) run.step(DT, idle());
    expect(destroyed).toBe(0);
  });

  it('loops the script: enemies keep spawning in the second and third passes', () => {
    const run = new Run();
    const serials = new Set<number>();
    for (let i = 0; i < 3 * ONE_PASS; i += 1) {
      run.step(DT, scripted(i));
      if (i < 2 * ONE_PASS) continue;
      const enemies = run.snapshot().enemies;
      for (let e = 0; e < enemies.count; e += 1) serials.add(enemies.at(e).serial);
    }
    expect(serials.size).toBeGreaterThan(10);
  });
});

describe('Level simulation — effects never change the run (ADR-0010)', () => {
  it('gives the same score, lives and event log with effects on and off', () => {
    const play = (effectsOn: boolean): string => {
      const run = new Run();
      const render = new RecordingRender();
      const presenter = new RunPresenter(
        render,
        {
          blink: effectsOn,
          hitFlash: effectsOn,
          explosions: effectsOn,
          shake: effectsOn,
          bombFlash: effectsOn,
        },
        run.events(),
      );
      const log: string[] = [];
      run.events().subscribe(GameEventKind.EnemyDestroyed, (e) => log.push(String(e.subject)));
      for (let i = 0; i < 2 * ONE_PASS; i += 1) {
        run.step(DT, scripted(i));
        render.clear();
        presenter.draw(run.snapshot(), 1, 16.7);
      }
      const snapshot = run.snapshot();
      return JSON.stringify({ log, score: snapshot.score, lives: snapshot.lives });
    };
    const on = play(true);
    expect(on).toBe(play(false));
    expect(on).not.toContain('"score":0,');
  });
});
