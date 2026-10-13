import { describe, expect, it } from 'vitest';
import { NoAttack } from '../../src/domain/game/attacks';
import { applyDamage } from '../../src/domain/game/body';
import { Boss, BossAdvance, BossState } from '../../src/domain/game/boss';
import type { BossDefinition, BossWorld } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import { SizeTier } from '../../src/domain/game/enemy';
import { overlapsField } from '../../src/domain/game/geometry';
import { swayMovement } from '../../src/domain/game/movements';
import type { MovementPattern } from '../../src/domain/game/movements';

const DT = 1 / 60;

/** A world with the ship at the bottom and a log of the enemy bullets fired. */
class TestWorld implements BossWorld {
  readonly bullets: { step: number; vx: number; vy: number }[] = [];
  step = 0;
  playerPosition(): { x: number; y: number } {
    return { x: 120, y: 272 };
  }
  spawnEnemyBullet(_x: number, _y: number, vx: number, vy: number): void {
    this.bullets.push({ step: this.step, vx, vy });
  }
}

/** One step as `Run` runs it: the boss moves at step 4, its timers advance at step 7. */
function tick(boss: Boss, world: TestWorld): BossAdvance {
  world.step += 1;
  boss.move(world, DT);
  return boss.advance(world);
}

function ticks(boss: Boss, world: TestWorld, n: number): void {
  for (let i = 0; i < n; i += 1) tick(boss, world);
}

function started(definition: BossDefinition = CRUISER): { boss: Boss; world: TestWorld } {
  const boss = new Boss();
  boss.start(definition, 7);
  return { boss, world: new TestWorld() };
}

/** Starts a Cruiser and plays its warning and entry: the fight begins on the next step. */
function fighting(definition: BossDefinition = CRUISER): { boss: Boss; world: TestWorld } {
  const fight = started(definition);
  ticks(fight.boss, fight.world, 360);
  return fight;
}

const SWAY_ONLY = (hp: number, thresholds: number[]): BossDefinition => ({
  stats: { hp, width: 112, height: 48, score: 0, tier: SizeTier.Large },
  phases: [hp, ...thresholds].map((hpThreshold) => ({
    hpThreshold,
    movement: swayMovement({ amplitude: 56, periodS: 8 }),
    attack: NoAttack,
  })),
  timeLimit: 90,
  warningS: 3,
  entryFrom: { x: 120, y: -24 },
  entryTo: { x: 120, y: 56 },
  entryS: 3,
  fleeSpeed: 60,
  destroyedS: 2,
});

describe('Boss — warning and entry (GDD v0.10 §6, 05-state-boss)', () => {
  it('starts in WARNING, off the field, with its stats and a full timer', () => {
    const { boss } = started();
    expect(boss.state).toBe(BossState.Warning);
    expect(boss.serial).toBe(7);
    expect(boss.hp).toBe(5000); // 500 level-1 shots in tenths (GDD v0.11 §6.1)
    expect(boss.width).toBe(112);
    expect(boss.height).toBe(48);
    expect(overlapsField(boss.position.x, boss.position.y, boss.width, boss.height)).toBe(false);
    expect(boss.secondsLeft()).toBe(90);
    expect(boss.isTargetable()).toBe(false);
    expect(boss.isHarmful()).toBe(false);
  });

  it('is WARNING for 3 s (180 steps), then ENTERING', () => {
    const { boss, world } = started();
    ticks(boss, world, 179);
    expect(boss.state).toBe(BossState.Warning);
    tick(boss, world);
    expect(boss.state).toBe(BossState.Entering);
  });

  it('slides in a straight line from (120, -24) to (120, 56) in 3 s: harmful, not targetable', () => {
    const { boss, world } = started();
    ticks(boss, world, 180);
    ticks(boss, world, 90);
    expect(boss.position.x).toBe(120);
    expect(boss.position.y).toBeCloseTo(16, 9);
    expect(boss.isHarmful()).toBe(true);
    expect(boss.isTargetable()).toBe(false);
    expect(boss.previousPosition.y).toBeCloseTo(16 - 80 / 180, 9);
    ticks(boss, world, 89);
    expect(boss.state).toBe(BossState.Entering);
    tick(boss, world);
    expect(boss.state).toBe(BossState.Fighting);
    expect(boss.position.y).toBeCloseTo(56, 9);
    expect(boss.secondsLeft()).toBe(90);
  });

  it('never goes below y 80 and starts the fight on the axis', () => {
    const { boss, world } = fighting();
    expect(boss.position.x).toBe(120);
    for (let i = 0; i < 600; i += 1) {
      tick(boss, world);
      expect(boss.position.y + boss.height / 2).toBeLessThanOrEqual(80);
    }
  });
});

describe('Boss — the entry slides on x as well as y (GDD v0.10 §6, ADR-0022)', () => {
  const DIAGONAL: BossDefinition = {
    ...SWAY_ONLY(5000, []),
    entryFrom: { x: 40, y: -24 },
    entryTo: { x: 200, y: 56 },
  };

  it('starts at the entry point, off the field, on x too', () => {
    const { boss } = started(DIAGONAL);
    expect([boss.position.x, boss.position.y]).toEqual([40, -24]);
  });

  it('is halfway on both axes after half the entry, and arrives at the entry target', () => {
    const { boss, world } = started(DIAGONAL);
    ticks(boss, world, 180); // the warning
    tick(boss, world);
    expect(boss.previousPosition.x).toBe(40);
    expect(boss.position.x).toBeCloseTo(40 + 160 / 180, 9);
    ticks(boss, world, 89); // 90 of 180 entry steps
    expect(boss.state).toBe(BossState.Entering);
    expect(boss.position.x).toBeCloseTo(120, 9);
    expect(boss.position.y).toBeCloseTo(16, 9);
    ticks(boss, world, 90);
    expect(boss.state).toBe(BossState.Fighting);
    expect(boss.position.x).toBeCloseTo(200, 9);
    expect(boss.position.y).toBeCloseTo(56, 9);
  });
});

describe('Boss — the fight timer (GDD v0.10 §6)', () => {
  it('runs only in FIGHTING and shows the steps left rounded up', () => {
    const { boss, world } = fighting();
    expect(boss.timeLeft).toBe(5400);
    tick(boss, world);
    expect(boss.timeLeft).toBe(5399);
    expect(boss.secondsLeft()).toBe(90);
    ticks(boss, world, 59);
    expect(boss.timeLeft).toBe(5340);
    expect(boss.secondsLeft()).toBe(89);
    ticks(boss, world, 5340 - 61);
    expect(boss.timeLeft).toBe(61);
    expect(boss.secondsLeft()).toBe(2);
    tick(boss, world);
    expect(boss.timeLeft).toBe(60);
    expect(boss.secondsLeft()).toBe(1);
    tick(boss, world);
    expect(boss.secondsLeft()).toBe(1);
  });

  it('expires after 90 s of fight: the boss flees, harmless and not targetable', () => {
    const { boss, world } = fighting();
    ticks(boss, world, 5399);
    expect(boss.state).toBe(BossState.Fighting);
    expect(tick(boss, world)).toBe(BossAdvance.Fled);
    expect(boss.state).toBe(BossState.Fleeing);
    expect(boss.isHarmful()).toBe(false);
    expect(boss.isTargetable()).toBe(false);
    expect(boss.armed).toBe(false);
  });

  it('flees straight up at 60 px/s until its box is fully above the field, then ends', () => {
    const { boss, world } = fighting();
    ticks(boss, world, 5400);
    const x = boss.position.x;
    const y = boss.position.y;
    tick(boss, world);
    expect(boss.position.x).toBe(x);
    expect(boss.position.y).toBeCloseTo(y - 1, 9);
    let ended: BossAdvance = BossAdvance.None;
    let guard = 0;
    while (ended === BossAdvance.None && guard < 1000) {
      ended = tick(boss, world);
      guard += 1;
    }
    expect(ended).toBe(BossAdvance.Ended);
    expect(boss.state).toBe(BossState.Idle);
    expect(boss.position.y + boss.height / 2).toBeLessThanOrEqual(0);
  });

  it('lets the destruction win when the HP and the timer both end in one step', () => {
    const { boss, world } = fighting();
    ticks(boss, world, 5399);
    // Step 5 of the last step: the kill; step 7 then finds a destroyed boss, not a fighting one.
    world.step += 1;
    boss.move(world, DT);
    expect(applyDamage(boss, 5000)).toBe(true);
    boss.destroy();
    expect(boss.advance(world)).toBe(BossAdvance.None);
    expect(boss.state).toBe(BossState.Destroyed);
    expect(boss.timeLeft).toBe(1);
  });
});

describe('Boss — destroyed (GDD v0.10 §6)', () => {
  it('is harmless and not targetable, lasts 2 s, then ends', () => {
    const { boss, world } = fighting();
    ticks(boss, world, 100);
    boss.destroy();
    expect(boss.isHarmful()).toBe(false);
    expect(boss.isTargetable()).toBe(false);
    expect(boss.armed).toBe(false);
    const secondsAtKill = boss.secondsLeft();
    ticks(boss, world, 119);
    expect(boss.state).toBe(BossState.Destroyed);
    expect(tick(boss, world)).toBe(BossAdvance.Ended);
    expect(boss.state).toBe(BossState.Idle);
    expect(boss.secondsLeft()).toBe(secondsAtKill);
  });
});

describe('Boss — phases (ADR-0023 decision 3)', () => {
  it('enters phase 2 at 66 % HP: the attack switches at once, the first ring 1.5 s later', () => {
    const { boss, world } = fighting();
    ticks(boss, world, 30);
    const before = world.bullets.length;
    expect(before).toBe(0);
    // GDD v0.11 §6.1: 5 000 − 3 300 = 1 700 tenths bring the Cruiser to its 66 % threshold.
    applyDamage(boss, 1700);
    expect(boss.hpRatio()).toBeCloseTo(0.66, 9);
    expect(boss.advancePhase(world)).toBe(true);
    expect(boss.phaseIndex).toBe(1);
    expect(boss.advancePhase(world)).toBe(false);
    expect(boss.volleys[0]).toBe(0);
    const changedAt = world.step;
    ticks(boss, world, 89);
    expect(world.bullets).toHaveLength(0);
    tick(boss, world);
    expect(world.step - changedAt).toBe(90);
    expect(world.bullets).toHaveLength(16);
  });

  it('does not enter phase 2 one tenth above its threshold', () => {
    const { boss, world } = fighting();
    applyDamage(boss, 1699);
    expect(boss.advancePhase(world)).toBe(false);
    expect(boss.phaseIndex).toBe(0);
  });

  it('crosses two thresholds with one hit, one phase at a time', () => {
    const { boss, world } = fighting(SWAY_ONLY(3000, [1980, 990]));
    applyDamage(boss, 2100);
    expect(boss.advancePhase(world)).toBe(true);
    expect(boss.phaseIndex).toBe(1);
    expect(boss.advancePhase(world)).toBe(true);
    expect(boss.phaseIndex).toBe(2);
    expect(boss.advancePhase(world)).toBe(false);
  });

  it.each([
    ['right', 100, true],
    ['left', 300, false],
  ])(
    'keeps its sway going %s until x crosses 120, then continues in that direction without a jump',
    (_label, hitAt, expectMirror) => {
      const { boss, world } = fighting();
      ticks(boss, world, hitAt);
      applyDamage(boss, 1700);
      expect(boss.advancePhase(world)).toBe(true);
      let previousX = boss.position.x;
      let swapped = false;
      for (let i = 0; i < 600 && !swapped; i += 1) {
        tick(boss, world);
        swapped = boss.age === 0;
        // The body never moves more than a phase-1 step, swap included (about 2.9 px at most).
        expect(Math.abs(boss.position.x - previousX)).toBeLessThan(3);
        previousX = boss.position.x;
      }
      expect(swapped).toBe(true);
      expect(boss.position.x).toBe(120);
      expect(boss.mirror).toBe(expectMirror);
      // Same direction as before: left when the old sway was going left, and so on.
      tick(boss, world);
      expect(boss.age).toBe(1);
      const movedLeft = boss.position.x < 120;
      expect(movedLeft).toBe(expectMirror);
      // From here the phase-2 sway: 72 px over 6 s.
      ticks(boss, world, 89);
      expect(Math.abs(boss.position.x - 120)).toBeCloseTo(72, 6);
    },
  );

  it('keeps counting the movement age at the threshold: only the swap restarts it', () => {
    const { boss, world } = fighting();
    ticks(boss, world, 100);
    applyDamage(boss, 1700);
    boss.advancePhase(world);
    expect(boss.age).toBe(100);
  });
});

describe('Boss — the movement swap on the axis itself (ADR-0023 decision 3)', () => {
  /** A phase-1 movement that puts x where the script says, by age (age 1 is the first fight step). */
  const scripted = (xs: readonly number[]): MovementPattern => ({
    tick(self): void {
      self.position.x = xs[self.age - 1] ?? 120;
    },
  });

  /** A two-phase boss whose first movement is scripted; the fight starts on x 120, phase 2 pending. */
  function pending(xs: readonly number[]): { boss: Boss; world: TestWorld } {
    const definition: BossDefinition = {
      ...SWAY_ONLY(5000, [3300]),
      phases: [
        { hpThreshold: 5000, movement: scripted(xs), attack: NoAttack },
        {
          hpThreshold: 3300,
          movement: swayMovement({ amplitude: 72, periodS: 6 }),
          attack: NoAttack,
        },
      ],
    };
    const fight = fighting(definition);
    applyDamage(fight.boss, 1700);
    expect(fight.boss.advancePhase(fight.world)).toBe(true);
    return fight;
  }

  it.each([
    ['from the left onto the axis', [110, 120], false],
    ['from the right onto the axis', [130, 120], true],
    ['from the left through the axis', [110, 130], false],
    ['from the right through the axis', [130, 110], true],
  ])('swaps in the step the sway reaches or crosses x 120: %s', (_label, xs, mirror) => {
    const { boss, world } = pending([...xs]);
    // The fight starts on the axis: the first step leaves it, with no sign change yet.
    tick(boss, world);
    expect([boss.age, boss.position.x]).toEqual([1, xs[0]]);
    tick(boss, world);
    expect([boss.age, boss.position.x, boss.mirror]).toEqual([0, 120, mirror]);
  });

  it('does not swap while the sway leaves the axis or stays on it, only when it later crosses', () => {
    const { boss, world } = pending([120, 130, 110]);
    tick(boss, world); // 120 → 120: on the axis, no sign change
    expect([boss.age, boss.position.x]).toEqual([1, 120]);
    tick(boss, world); // 120 → 130: leaves the axis, still no sign change
    expect([boss.age, boss.position.x]).toEqual([2, 130]);
    tick(boss, world); // 130 → 110: crosses
    expect([boss.age, boss.position.x, boss.mirror]).toEqual([0, 120, true]);
  });

  it('swaps once: after the swap the phase-2 sway runs, with no second restart', () => {
    const { boss, world } = pending([110, 130]);
    ticks(boss, world, 2);
    expect(boss.age).toBe(0);
    ticks(boss, world, 30);
    expect(boss.age).toBe(30);
  });
});

describe('Boss — the Cruiser definition is well formed (data checked once, not at run time)', () => {
  it('has a positive duration for every state and a descending threshold per phase', () => {
    expect(CRUISER.phases.length).toBeGreaterThanOrEqual(1);
    for (const seconds of [
      CRUISER.warningS,
      CRUISER.entryS,
      CRUISER.destroyedS,
      CRUISER.timeLimit,
    ]) {
      expect(seconds).toBeGreaterThan(0);
    }
    expect(CRUISER.fleeSpeed).toBeGreaterThan(0);
    expect(CRUISER.phases[0]?.hpThreshold).toBe(CRUISER.stats.hp);
    for (let i = 1; i < CRUISER.phases.length; i += 1) {
      const previous = CRUISER.phases[i - 1]?.hpThreshold ?? 0;
      const threshold = CRUISER.phases[i]?.hpThreshold ?? 0;
      expect(threshold).toBeLessThan(previous);
      expect(threshold).toBeGreaterThan(0);
    }
  });

  it('enters inside the field width and ends its entry at the fighting height', () => {
    expect(CRUISER.entryFrom.x).toBe(CRUISER.entryTo.x);
    expect(CRUISER.entryTo.y + CRUISER.stats.height / 2).toBeLessThanOrEqual(80);
  });
});

describe('Boss — the Cruiser at 1 s (GDD v0.10 §6.1)', () => {
  it('fires its first volley, a fan of 5 at the ship, 1 s into the fight', () => {
    const { boss, world } = fighting();
    ticks(boss, world, 59);
    expect(world.bullets).toHaveLength(0);
    tick(boss, world);
    expect(world.bullets).toHaveLength(5);
    ticks(boss, world, 60);
    expect(world.bullets).toHaveLength(5 + 12);
    ticks(boss, world, 60);
    expect(world.bullets).toHaveLength(5 + 12 + 5);
  });

  it('does not fire while warning or entering', () => {
    const { boss, world } = started();
    ticks(boss, world, 360 - 1);
    expect(world.bullets).toHaveLength(0);
  });
});
