import { describe, expect, it } from 'vitest';
import type { Bullet } from '../../src/domain/game/bullet';
import type { Enemy } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
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

/** Plays a run and returns its event log and final state as JSON. */
function replay(steps: number): string {
  const run = new Run();
  const log: string[] = [];
  const record = (event: Readonly<GameEvent>): void => {
    log.push(`${String(event.kind)}:${String(event.subject)}:${event.position.x.toFixed(3)}`);
  };
  const events = run.events();
  events.subscribe(GameEventKind.EnemyHit, record);
  events.subscribe(GameEventKind.EnemyDestroyed, record);
  events.subscribe(GameEventKind.PlayerDied, record);
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
  it('replays identically from the same scripted inputs over three loops', () => {
    const first = replay(3 * ONE_PASS);
    expect(first).toBe(replay(3 * ONE_PASS));
    expect(first).toContain(`"${String(GameEventKind.EnemyDestroyed)}:`);
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

  it('never uses more than the pools hold, and enemy bullets peak at 40 or fewer', () => {
    const run = new Run();
    const enemies = new Set<Enemy>();
    const bullets = new Set<Readonly<Bullet>>();
    let peak = 0;
    for (let i = 0; i < 3 * ONE_PASS; i += 1) {
      run.step(DT, scripted(i));
      const snapshot = run.snapshot();
      for (let e = 0; e < snapshot.enemies.count; e += 1) enemies.add(snapshot.enemies.at(e));
      for (let b = 0; b < snapshot.enemyBullets.count; b += 1) {
        bullets.add(snapshot.enemyBullets.at(b));
      }
      peak = Math.max(peak, snapshot.enemyBullets.count);
    }
    expect(enemies.size).toBeLessThanOrEqual(16);
    expect(bullets.size).toBeLessThanOrEqual(48);
    expect(peak).toBeLessThanOrEqual(40);
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
