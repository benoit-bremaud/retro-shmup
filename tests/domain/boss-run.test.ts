import { describe, expect, it } from 'vitest';
import { NoAttack } from '../../src/domain/game/attacks';
import { BossState } from '../../src/domain/game/boss';
import type { BossDefinition } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import { DIVER } from '../../src/domain/game/enemy';
import { GameEventKind } from '../../src/domain/game/events';
import type { GameEvent } from '../../src/domain/game/events';
import { swayMovement } from '../../src/domain/game/movements';
import { PlayerState } from '../../src/domain/game/player';
import type { Player } from '../../src/domain/game/player';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { KitTuning } from '../../src/domain/game/tuning';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { STUB_BOSS, testScript } from '../support/script';
import { shots } from '../support/shots';

const DT = 1 / 60;
/** The warning of every script here, in seconds: the boss starts on step 301. */
const WARNING_AT = 5;
const WARNING_STEP = 301;
/** Nothing else spawns in these scripts: the boss takes the run's first serial. */
const BOSS_SERIAL = 1;

/** The Cruiser's stats and timings with no attack and no sway, so nothing hurts or moves. */
function quiet(thresholds: number[] = [1980]): BossDefinition {
  return {
    ...CRUISER,
    phases: [3000, ...thresholds].map((hpThreshold) => ({
      hpThreshold,
      movement: swayMovement({ amplitude: 0, periodS: 8 }),
      attack: NoAttack,
    })),
  };
}

function bossRun(
  boss: BossDefinition = quiet(),
  extra: Partial<Parameters<typeof testScript>[1]> = {},
) {
  return new Run({ script: testScript([], { warningAt: WARNING_AT, boss, ...extra }) });
}

function idle(): IntentFrame {
  return createIntentFrame();
}

function pressing(button: number): IntentFrame {
  const frame = createIntentFrame();
  frame.pressed = button;
  return frame;
}

function steps(run: Run, n: number, frame: Readonly<IntentFrame> = idle()): void {
  for (let i = 0; i < n; i += 1) run.step(DT, frame);
}

/** Steps until the boss is in `state`; fails the test if it never is. */
function stepUntilBoss(run: Run, state: BossState, limit = 20000): void {
  for (let i = 0; i < limit; i += 1) {
    if (run.snapshot().boss.state === state) return;
    run.step(DT, idle());
  }
  throw new Error(`the boss never reached ${state}`);
}

function fighting(boss: BossDefinition = quiet()): Run {
  const run = bossRun(boss);
  stepUntilBoss(run, BossState.Fighting);
  return run;
}

interface Logged {
  kind: number;
  subject: number;
  value: number;
  detail: number;
}

function logOf(run: Run, kinds: readonly GameEventKind[]): Logged[] {
  const log: Logged[] = [];
  for (const kind of kinds) {
    run.events().subscribe(kind, (e: Readonly<GameEvent>) => {
      log.push({ kind: e.kind, subject: e.subject, value: e.value, detail: e.detail });
    });
  }
  return log;
}

/** The ship's hit, as a bullet would deal it (a test seam: the live player behind the snapshot). */
function hitShip(run: Run): void {
  (run.snapshot().player as Player).hit();
}

describe('Run — the boss starts at warningAt (02-sequence-boss-fight)', () => {
  it('starts it in WARNING on the step that reaches warningAt and publishes BOSS_WARNING', () => {
    const run = bossRun();
    const log = logOf(run, [GameEventKind.BossWarning]);
    steps(run, WARNING_STEP - 1);
    expect(run.snapshot().boss.state).toBe(BossState.Idle);
    steps(run, 1);
    expect(run.snapshot().boss.state).toBe(BossState.Warning);
    expect(log).toHaveLength(1);
    expect(log[0]?.subject).toBeGreaterThan(0);
    steps(run, 600);
    expect(log).toHaveLength(1);
  });

  it('draws the boss serial from the run counter, after the enemy spawned before it', () => {
    const run = new Run({
      script: testScript([{ at: 0, archetype: DIVER, count: 1, spawn: { x: 20, y: -8 } }], {
        warningAt: WARNING_AT,
        boss: quiet(),
      }),
    });
    const log = logOf(run, [GameEventKind.BossWarning]);
    steps(run, WARNING_STEP);
    expect(log[0]?.subject).toBe(2);
  });

  it('shows the boss in the snapshot: state, HP, seconds left, phase', () => {
    const run = bossRun();
    steps(run, WARNING_STEP);
    const boss = run.snapshot().boss;
    expect([boss.state, boss.hpRatio, boss.secondsLeft, boss.phase, boss.stateSteps]).toEqual([
      BossState.Warning,
      1,
      90,
      0,
      1,
    ]);
    expect(boss.width).toBe(112);
  });
});

describe('Run.damageBoss (ADR-0022 decision 5)', () => {
  it('lowers the HP, publishes ENEMY_HIT with the boss serial and scores 0', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.EnemyHit, GameEventKind.BossPhaseChanged]);
    run.damageBoss(shots(10));
    expect(run.snapshot().boss.hpRatio).toBeCloseTo(0.9666666, 6);
    expect(log).toHaveLength(1);
    expect(log[0]?.subject).toBe(BOSS_SERIAL);
    expect(run.snapshot().score).toBe(0);
  });

  it('publishes BOSS_PHASE_CHANGED once at 66 % HP, with the new phase as detail', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.BossPhaseChanged]);
    run.damageBoss(1019);
    expect(log).toHaveLength(0);
    run.damageBoss(1);
    expect(log).toEqual([expect.objectContaining({ detail: 1 })]);
    run.damageBoss(1);
    expect(log).toHaveLength(1);
    expect(run.snapshot().boss.phase).toBe(1);
  });

  it('publishes one BOSS_PHASE_CHANGED per threshold a single hit crosses', () => {
    const run = fighting(quiet([1980, 990]));
    const log = logOf(run, [GameEventKind.BossPhaseChanged]);
    run.damageBoss(2100);
    expect(log.map((e) => e.detail)).toEqual([1, 2]);
    expect(run.snapshot().boss.phase).toBe(2);
  });

  it('destroys the boss at 0 HP: bullets cancelled, BOSS_DESTROYED with the seconds left', () => {
    const run = fighting(CRUISER);
    steps(run, 60);
    expect(run.snapshot().enemyBullets.count).toBeGreaterThan(0);
    const log = logOf(run, [GameEventKind.BossDestroyed, GameEventKind.BossPhaseChanged]);
    const left = run.snapshot().boss.secondsLeft;
    run.damageBoss(3000);
    expect(log).toEqual([
      expect.objectContaining({ kind: GameEventKind.BossDestroyed, value: left }),
    ]);
    expect(run.snapshot().boss.state).toBe(BossState.Destroyed);
    steps(run, 1);
    expect(run.snapshot().enemyBullets.count).toBe(0);
  });

  it('pays 10 000 + 100 × the seconds left, flat, and leaves the chain alone', () => {
    const run = fighting();
    steps(run, 100);
    expect(run.snapshot().boss.secondsLeft).toBe(89);
    const multiplier = run.snapshot().multiplier;
    run.damageBoss(3000);
    expect(run.snapshot().score).toBe(10000 + 100 * 89);
    expect(run.snapshot().multiplier).toBe(multiplier);
  });

  it('is shot down by the ship: a Spread stream at x 120 reaches the fighting boss', () => {
    const run = bossRun(quiet());
    stepUntilBoss(run, BossState.Fighting);
    const hits = logOf(run, [GameEventKind.EnemyHit]);
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    steps(run, 200, fire);
    expect(hits.length).toBeGreaterThan(0);
    expect(run.snapshot().boss.hpRatio).toBeLessThan(1);
    expect(run.snapshot().score).toBe(0);
  });

  it('is not hit by shots before it fights', () => {
    const run = bossRun(quiet());
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    steps(run, WARNING_STEP + 300, fire);
    expect(run.snapshot().boss.state).toBe(BossState.Entering);
    expect(run.snapshot().boss.hpRatio).toBe(1);
  });
});

describe('Run — the bomb and the boss (02-sequence-bomb, GDD v0.10 §6)', () => {
  it.each([BossState.Warning, BossState.Entering])(
    'cancels the bullets but does not hurt the boss in %s',
    (state) => {
      const run = bossRun(quiet());
      stepUntilBoss(run, state);
      const hits = logOf(run, [GameEventKind.EnemyHit, GameEventKind.BombUsed]);
      steps(run, 1, pressing(Button.Bomb));
      expect(hits.map((e) => e.kind)).toEqual([GameEventKind.BombUsed]);
      expect(run.snapshot().boss.hpRatio).toBe(1);
    },
  );

  it('deals 300 tenths to the fighting boss', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.BombUsed, GameEventKind.EnemyHit]);
    steps(run, 1, pressing(Button.Bomb));
    expect(log.map((e) => e.kind)).toEqual([GameEventKind.BombUsed, GameEventKind.EnemyHit]);
    expect(run.snapshot().boss.hpRatio).toBeCloseTo(1 - KitTuning.bombDamage / 3000, 9);
  });

  it('advances a phase when the bomb crosses the threshold, and destroys at 0 HP', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.BossPhaseChanged, GameEventKind.BossDestroyed]);
    run.damageBoss(1700);
    steps(run, 1, pressing(Button.Bomb));
    expect(log.map((e) => e.kind)).toEqual([GameEventKind.BossPhaseChanged]);
    run.damageBoss(shots(0) + 3000 - 1700 - KitTuning.bombDamage - 1);
    expect(run.snapshot().boss.hpRatio).toBeGreaterThan(0);
    steps(run, 1, pressing(Button.Bomb));
    expect(log.map((e) => e.kind)).toEqual([
      GameEventKind.BossPhaseChanged,
      GameEventKind.BossDestroyed,
    ]);
  });
});

describe('Run — the end of the fight (GDD v0.10 §6)', () => {
  it('flees when the 90 s timer runs out: BOSS_FLED, no bonus, bullets cancelled', () => {
    const run = fighting(CRUISER);
    const log = logOf(run, [GameEventKind.BossFled, GameEventKind.BossDestroyed]);
    // The Cruiser's fan is aimed at an idle ship: a ship that dodges lives, one that does not
    // dies; this test is about the timer, so the ship is kept alive.
    for (let i = 0; i < 5400; i += 1) {
      run.step(DT, idle());
      if (run.snapshot().boss.state !== BossState.Fighting) break;
      if (run.snapshot().player.state === PlayerState.Dead) hitShip(run);
    }
    expect(log.map((e) => e.kind)).toEqual([GameEventKind.BossFled]);
    expect(run.snapshot().boss.state).toBe(BossState.Fleeing);
    expect(run.snapshot().score).toBe(0);
    steps(run, 1);
    expect(run.snapshot().enemyBullets.count).toBe(0);
  });

  it('publishes LEVEL_CLEARED once, 2 s after the kill, with the bombs left, and ends the run', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.LevelCleared]);
    run.damageBoss(3000);
    steps(run, 119);
    expect(log).toHaveLength(0);
    expect(run.outcome()).toBe(RunOutcome.Playing);
    steps(run, 1);
    expect(log).toEqual([expect.objectContaining({ value: run.snapshot().bombs })]);
    expect(run.snapshot().bombs).toBeGreaterThan(0);
    expect(run.outcome()).toBe(RunOutcome.RunCleared);
    steps(run, 300);
    expect(log).toHaveLength(1);
    expect(run.snapshot().boss.state).toBe(BossState.Idle);
  });

  it('ends with LEVEL_CLEARED, not RUN_CLEARED, while another level follows in the list', () => {
    const script = testScript([], { warningAt: WARNING_AT, boss: quiet() });
    const run = new Run({ levels: [script, script] });
    stepUntilBoss(run, BossState.Fighting);
    run.damageBoss(3000);
    steps(run, 120);
    expect(run.outcome()).toBe(RunOutcome.LevelCleared);
  });

  it('spends the ship bullets at the level end', () => {
    const run = fighting();
    run.damageBoss(3000);
    const fire = createIntentFrame();
    fire.held = Button.Fire;
    steps(run, 119, fire);
    steps(run, 1, fire);
    expect(run.outcome()).toBe(RunOutcome.RunCleared);
    steps(run, 1);
    expect(run.snapshot().playerBullets.count).toBe(0);
  });

  it('flees after the timer, then clears the level when the boss is above the field', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.BossFled, GameEventKind.LevelCleared]);
    steps(run, 5400);
    expect(run.snapshot().boss.state).toBe(BossState.Fleeing);
    // 48 px box from y 56: its bottom edge leaves the top after (56 + 24) / 60 s.
    steps(run, 82);
    expect(log.map((e) => e.kind)).toEqual([GameEventKind.BossFled, GameEventKind.LevelCleared]);
    expect(run.outcome()).toBe(RunOutcome.RunCleared);
  });

  it('defers the level end while the ship is Dead, and clears it when the ship is back', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.LevelCleared]);
    run.damageBoss(3000);
    steps(run, 100);
    hitShip(run);
    expect(run.snapshot().player.state).toBe(PlayerState.Dead);
    // The sequence ends 20 steps later, the ship dies for 90.
    steps(run, 60);
    expect(log).toHaveLength(0);
    expect(run.outcome()).toBe(RunOutcome.Playing);
    steps(run, 40);
    expect(log).toHaveLength(1);
    expect(run.outcome()).toBe(RunOutcome.RunCleared);
  });

  it('lets GAME_OVER win over a pending level end: no LEVEL_CLEARED after the last life', () => {
    const run = fighting();
    const log = logOf(run, [GameEventKind.LevelCleared]);
    hitShip(run);
    steps(run, 100 + 30 + 90 + 10);
    expect(run.snapshot().player.state).toBe(PlayerState.Vulnerable);
    hitShip(run);
    steps(run, 100 + 30 + 90 + 10);
    expect(run.snapshot().player.state).toBe(PlayerState.Vulnerable);
    run.damageBoss(3000);
    steps(run, 100);
    hitShip(run);
    steps(run, 200);
    expect(run.outcome()).toBe(RunOutcome.GameOver);
    expect(log).toHaveLength(0);
  });
});

describe('Run — config', () => {
  it('needs at least one level', () => {
    expect(() => new Run({ levels: [] })).toThrow(RangeError);
  });

  it('keeps the stub boss out of the way of a short test script', () => {
    const run = new Run({ script: testScript() });
    steps(run, 600);
    expect(run.snapshot().boss.state).toBe(BossState.Idle);
    expect(STUB_BOSS.stats.hp).toBe(50);
  });
});
