import { describe, expect, it } from 'vitest';
import { BossState } from '../../src/domain/game/boss';
import type { BossDefinition } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import { LEVEL_1 } from '../../src/domain/game/level-script';
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
const ONE_PASS = 7200; // the waves of level 1 last 120 s, then the WARNING starts the Cruiser
/**
 * A seed whose drops give the scripted ship the power to kill the 1 800-shot Cruiser (GDD v0.18):
 * found by trying seeds 1 to 14 in order (kills on 3, 10 and 11); on a change to the random draws,
 * search the same way. The kill rates themselves are guarded by `tests/balance`.
 */
const BOSS_KILL_SEED = 10;
const frame = createIntentFrame();

/** A weaving player who fires most of the time: same index, same frame. */
function scripted(i: number): IntentFrame {
  frame.moveKind = 'direction';
  frame.moveX = Math.floor(i / 90) % 2 === 0 ? 1 : -1;
  frame.moveY = i % 240 < 120 ? -0.5 : 0.5;
  frame.held = i % 10 < 8 ? Button.Fire : 0;
  // A bomb every 10 s: the bomb's kills and effects are part of every replay.
  frame.pressed = i % 600 === 300 ? Button.Bomb : 0;
  return frame;
}

/** The same weave without firing: nothing is shot down, so every enemy lives its whole life. */
function pacifist(i: number): IntentFrame {
  scripted(i);
  frame.held = 0;
  frame.pressed = 0;
  return frame;
}

/**
 * The ship in the boss fight (GDD v0.18 §6.1: 1 800 shots in 90 s, so the ship needs power 4 to 5
 * and few misses): a blind weave dies four times in that time, so from the WARNING the scripted
 * ship steps away from the nearest enemy bullet above it, else follows the boss, and fires without
 * pause. The v0.18 bullets (85 px/s, a volley every 0.9 s) made the old 22 px and 70 px windows
 * thrash between two fans, so the window is now narrower (12 px across, 50 px ahead).
 */
function dodging(run: Run): IntentFrame {
  const snapshot = run.snapshot();
  const me = snapshot.player.position;
  let away = 0;
  let nearest = Infinity;
  for (let k = 0; k < snapshot.enemyBullets.count; k += 1) {
    const bullet = snapshot.enemyBullets.at(k).position;
    const below = me.y - bullet.y;
    const across = me.x - bullet.x;
    if (below > -10 && below < 50 && Math.abs(across) < 12 && Math.abs(across) + below < nearest) {
      nearest = Math.abs(across) + below;
      away = across >= 0 ? 1 : -1;
    }
  }
  const towardBoss = snapshot.boss.position.x - me.x;
  let move = away;
  if (away === 0 && Math.abs(towardBoss) > 4) move = towardBoss > 0 ? 0.6 : -0.6;
  if (me.x < 30 && move < 0) move = 1;
  if (me.x > 210 && move > 0) move = -1;
  frame.moveKind = 'direction';
  frame.moveX = move;
  // Stay low on the field, between y 250 and 290.
  frame.moveY = 0;
  if (me.y < 250) frame.moveY = 0.4;
  else if (me.y > 290) frame.moveY = -0.4;
  frame.held = Button.Fire;
  frame.pressed = 0;
  return frame;
}

/** The weave for the waves, then the dodging ship once the WARNING has started the boss. */
function fighter(run: Run, i: number): IntentFrame {
  return i < ONE_PASS ? scripted(i) : dodging(run);
}

function idle(): IntentFrame {
  frame.moveKind = 'none';
  frame.moveX = 0;
  frame.moveY = 0;
  frame.held = 0;
  return frame;
}

/** The boss and level events of the replay log (ADR-0022 decision 6). */
const BOSS_KINDS = [
  GameEventKind.BossWarning,
  GameEventKind.BossPhaseChanged,
  GameEventKind.BossDestroyed,
  GameEventKind.BossFled,
  GameEventKind.LevelCleared,
] as const;

/** Plays a run from `seed` and returns its event log and final state as JSON (ADR-0019). */
function replay(steps: number, seed = 1, fightsBoss = false): string {
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
  events.subscribe(GameEventKind.BombUsed, record);
  const recordBoss = (event: Readonly<GameEvent>): void => {
    log.push(
      `${String(event.kind)}:${String(event.subject)}:${String(event.value)}:${String(event.detail)}`,
    );
  };
  for (const kind of BOSS_KINDS) events.subscribe(kind, recordBoss);
  for (let i = 0; i < steps; i += 1) run.step(DT, fightsBoss ? fighter(run, i) : scripted(i));
  const snapshot = run.snapshot();
  const boss = snapshot.boss;
  return JSON.stringify({
    log,
    score: snapshot.score,
    lives: snapshot.lives,
    outcome: run.outcome(),
    // The end-of-level tally (GDD v0.10 §8): its lines replay too.
    tally: [
      run.tally().formationsCleared,
      run.tally().bombUsed,
      run.tally().lifeLost,
      run.tally().bombsLeft,
      run.tally().total(),
    ],
    ship: snapshot.player,
    // The boss's body between its events: a drift of its motion, HP or phase must show here.
    boss: [boss.state, boss.position.x, boss.position.y, boss.hpRatio, boss.phase, boss.stateSteps],
  });
}

describe('Level simulation — level 1, headless', () => {
  it('replays identically from the same seed and scripted inputs over two passes', () => {
    // Seed 1 still rolls a Bomb drop under GDD v0.12 (at step 5630 of the first pass; seed 3, used
    // for v0.11, no longer does: the ship's life, the P chain and so the draws changed).
    const first = replay(2 * ONE_PASS);
    expect(first).toBe(replay(2 * ONE_PASS));
    const { log } = JSON.parse(first) as { log: string[] };
    const has = (prefix: string): boolean => log.some((entry) => entry.startsWith(prefix));
    expect(has(`${String(GameEventKind.EnemyDestroyed)}:`)).toBe(true);
    expect(has(`${String(GameEventKind.PickupSpawned)}:`)).toBe(true);
    expect(has(`${String(GameEventKind.BombUsed)}:`)).toBe(true);
    // The Carriers' cargo is in the log, so the pickup-peak test below covers it.
    expect(has(`${String(GameEventKind.PickupSpawned)}:${String(PickupKind.Shield)}:`)).toBe(true);
    expect(has(`${String(GameEventKind.PickupSpawned)}:${String(PickupKind.Bomb)}:`)).toBe(true);
  });

  it('replays identically through the whole boss fight: warning, phase, destruction, level end', () => {
    // Seed 10, not 1 (GDD v0.18): the 1 800-shot Cruiser dies only to a ship that kept its power,
    // and seed 1's drops leave the scripted ship short of the kill in 90 s (the boss flees).
    const { log } = JSON.parse(replay(ONE_PASS + 6000, BOSS_KILL_SEED, true)) as { log: string[] };
    const kinds = log.map((entry) => entry.split(':')[0]);
    // The scripted ship destroys the boss: every boss event but its escape is in the log.
    for (const kind of BOSS_KINDS) {
      if (kind === GameEventKind.BossFled) continue;
      expect(kinds, String(kind)).toContain(String(kind));
    }
    expect(kinds).not.toContain(String(GameEventKind.BossFled));
    expect(replay(ONE_PASS + 6000, BOSS_KILL_SEED, true)).toBe(
      replay(ONE_PASS + 6000, BOSS_KILL_SEED, true),
    );
  });

  it('lets the seed change the drops (ADR-0019)', () => {
    const logs = new Set<string>();
    for (let seed = 1; seed <= 6; seed += 1) logs.add(replay(ONE_PASS, seed));
    expect(logs.size).toBeGreaterThan(1);
  });

  it("never fills the pickup pool with the script's own drops (GDD v0.8 §4.6)", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const run = new Run({ seed });
      let most = 0;
      for (let i = 0; i < 2 * ONE_PASS; i += 1) {
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

  it.each([
    ['a firing player', scripted],
    ['a player who never fires', pacifist],
  ])(
    'keeps one whole pass at 16 enemies and 40 enemy bullets or fewer, for %s (GDD v0.10 §7.2.2)',
    (_label, inputs) => {
      for (let seed = 1; seed <= 6; seed += 1) {
        const run = new Run({ seed });
        let peakEnemies = 0;
        let peakBullets = 0;
        for (let i = 0; i < ONE_PASS; i += 1) {
          run.step(DT, inputs(i));
          const snapshot = run.snapshot();
          peakEnemies = Math.max(peakEnemies, snapshot.enemies.count);
          peakBullets = Math.max(peakBullets, snapshot.enemyBullets.count);
        }
        // Below the pool of 16: no spawn was ever refused.
        expect(peakEnemies).toBeLessThan(ENEMY_POOL_SIZE);
        expect(peakBullets).toBeLessThanOrEqual(40);
        expect(peakBullets).toBeLessThan(ENEMY_BULLET_POOL_SIZE);
      }
    },
  );

  it('meets every Heavy of level 1 and the 1-UP Carrier in one pass', () => {
    const run = new Run();
    const archetypes = new Set<string>();
    const cargos = new Set<PickupKind>();
    for (let i = 0; i < ONE_PASS; i += 1) {
      run.step(DT, pacifist(i));
      const enemies = run.snapshot().enemies;
      for (let e = 0; e < enemies.count; e += 1) {
        const enemy = enemies.at(e);
        archetypes.add(enemy.archetype.id);
        if (enemy.archetype.id === 'carrier' && enemy.cargo !== undefined) cargos.add(enemy.cargo);
      }
    }
    expect(archetypes).toContain('heavy-ring');
    expect(archetypes).toContain('heavy-fan');
    expect(cargos).toContain(PickupKind.OneUp);
    expect(cargos).not.toContain(PickupKind.Bomb);
  });

  it('keeps room in the bullet pool when the ring and the fan fire together at 102 s', () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const run = new Run({ seed });
      let peak = 0;
      for (let i = 0; i < ONE_PASS; i += 1) {
        run.step(DT, pacifist(i));
        if (i >= 102 * 60 && i < 116 * 60) peak = Math.max(peak, run.snapshot().enemyBullets.count);
      }
      // A ring (12) and a fan (5) in the air at once, yet 12 slots to spare: a full pool would
      // drop bullets silently and cut a ring short.
      expect(peak).toBeGreaterThanOrEqual(24);
      expect(peak).toBeLessThanOrEqual(ENEMY_BULLET_POOL_SIZE - 12);
    }
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
});

describe('Level simulation — the Cruiser, headless (GDD v0.10 §6, §6.1)', () => {
  it.each([
    ['a firing player', scripted],
    ['a player who never fires', pacifist],
    ['an idle ship', idle],
  ])('leaves the field empty of wave enemies when the WARNING starts, for %s', (_label, inputs) => {
    // GDD §6: the ship cannot die during the end of the fight, so no wave enemy may still be alive.
    for (let seed = 1; seed <= 4; seed += 1) {
      const run = new Run({ seed });
      let aliveAtWarning = -1;
      for (let i = 0; i < ONE_PASS + 600 && aliveAtWarning < 0; i += 1) {
        run.step(DT, inputs(i));
        const snapshot = run.snapshot();
        if (snapshot.boss.state === BossState.Warning) aliveAtWarning = snapshot.enemies.count;
      }
      expect(aliveAtWarning, `seed ${String(seed)}`).toBe(0);
    }
  });

  it('reaches BOSS_WARNING at step 7200, once, and not a step before', () => {
    const run = new Run({ seed: 1 });
    const warnedAt: number[] = [];
    let now = 0;
    run.events().subscribe(GameEventKind.BossWarning, () => warnedAt.push(now));
    for (let i = 0; i < 2 * ONE_PASS; i += 1) {
      now = i;
      run.step(DT, scripted(i));
    }
    expect(warnedAt).toEqual([7200]);
  });

  it('is cleared by the scripted ship: the boss destroyed, its bonus paid, RUN_CLEARED', () => {
    const run = new Run({ seed: BOSS_KILL_SEED });
    let bonusSeconds = -1;
    let cleared = 0;
    run.events().subscribe(GameEventKind.BossDestroyed, (e) => {
      bonusSeconds = e.value;
    });
    run.events().subscribe(GameEventKind.LevelCleared, () => {
      cleared += 1;
    });
    for (let i = 0; i < ONE_PASS + 6000 && run.outcome() === RunOutcome.Playing; i += 1) {
      run.step(DT, fighter(run, i));
    }
    expect(run.outcome()).toBe(RunOutcome.RunCleared);
    expect(cleared).toBe(1);
    expect(bonusSeconds).toBeGreaterThan(0);
    expect(run.snapshot().score).toBeGreaterThanOrEqual(10000 + 100 * bonusSeconds);
  });

  /** The Cruiser with HP no player kills and phase 2 one tenth below full: held for its timer. */
  const [phase1, phase2] = CRUISER.phases;
  if (phase1 === undefined || phase2 === undefined) throw new Error('the Cruiser has two phases');
  const HELD_IN_PHASE_2: BossDefinition = {
    ...CRUISER,
    stats: { ...CRUISER.stats, hp: 1e7 },
    phases: [
      { ...phase1, hpThreshold: 1e7 },
      { ...phase2, hpThreshold: 1e7 - 1 },
    ],
  };

  it.each([
    ['a firing player', scripted],
    ['a player who never fires', pacifist],
    ['an idle ship', idle],
  ])(
    'keeps phase 2, held for its whole 90 s, at 40 enemy bullets or fewer, never filling the pool, for %s',
    (_label, inputs) => {
      const run = new Run({ seed: 1, levels: [{ ...LEVEL_1, boss: HELD_IN_PHASE_2 }] });
      let i = 0;
      while (run.snapshot().boss.state !== BossState.Fighting) run.step(DT, inputs(i++));
      run.rules.damageBoss(1);
      expect(run.snapshot().boss.phase).toBe(1);
      let peak = 0;
      while (run.snapshot().boss.state === BossState.Fighting) {
        run.step(DT, inputs(i++));
        peak = Math.max(peak, run.snapshot().enemyBullets.count);
      }
      expect(run.snapshot().boss.state).toBe(BossState.Fleeing);
      expect(peak).toBeGreaterThan(24);
      // GDD v0.10 §6.1: at most 40. The pool of 48 then keeps 8 slots at least; the peak is 40
      // since v0.18 (a ring of 14 every 1.25 s; a ring of 16 reached 45, over the limit).
      expect(peak).toBeLessThanOrEqual(40);
      expect(peak).toBeLessThan(ENEMY_BULLET_POOL_SIZE);
    },
  );

  it('lets a ship that never fires (power 1) watch the Cruiser flee, with no bonus', () => {
    const run = new Run({ seed: 1 });
    const kinds: GameEventKind[] = [];
    for (const kind of BOSS_KINDS) run.events().subscribe(kind, (e) => kinds.push(e.kind));
    for (let i = 0; i < ONE_PASS + 361 + 5400 + 400; i += 1) run.step(DT, pacifist(i));
    expect(kinds).toContain(GameEventKind.BossFled);
    expect(kinds).not.toContain(GameEventKind.BossDestroyed);
    expect(run.snapshot().score).toBe(0);
    expect(run.snapshot().boss.state).toBe(BossState.Idle);
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
          slowMotion: effectsOn,
          championName: effectsOn,
        },
        run.events(),
      );
      const log: string[] = [];
      run.events().subscribe(GameEventKind.EnemyDestroyed, (e) => log.push(String(e.subject)));
      run.events().subscribe(GameEventKind.BombUsed, () => log.push('bomb'));
      for (let i = 0; i < 2 * ONE_PASS; i += 1) {
        run.step(DT, scripted(i));
        render.clear();
        presenter.applyShake();
        presenter.draw(run.snapshot(), 1, 16.7);
      }
      const snapshot = run.snapshot();
      return JSON.stringify({ log, score: snapshot.score, lives: snapshot.lives });
    };
    const on = play(true);
    expect(on).toBe(play(false));
    expect(on).toContain('bomb');
    expect((JSON.parse(on) as { score: number }).score).toBeGreaterThan(0);
  });
});
