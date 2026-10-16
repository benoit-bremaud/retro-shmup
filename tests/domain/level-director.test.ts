import { describe, expect, it } from 'vitest';
import type { BossDefinition } from '../../src/domain/game/boss';
import { CRUISER } from '../../src/domain/game/cruiser';
import { CARRIER, DIVER, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import { Formation } from '../../src/domain/game/formation';
import { LevelDirector } from '../../src/domain/game/level-director';
import type { EnemySpawner } from '../../src/domain/game/level-director';
import { LEVEL_1 } from '../../src/domain/game/level-script';
import { PickupKind } from '../../src/domain/game/pickup';
import type { LevelScript, ScriptEvent } from '../../src/domain/game/level-script';
import { testScript } from '../support/script';

/** Records which archetype spawned on which tick (1 = the run's first step). */
class Recorder implements EnemySpawner {
  tick = 0;
  readonly spawns: { tick: number; id: string; x: number }[] = [];
  readonly bosses: { tick: number; definition: BossDefinition }[] = [];
  readonly formations: Formation[] = [];
  readonly members: (Formation | undefined)[] = [];
  startFormation(size: number, paysP: boolean): Formation {
    const formation = new Formation();
    formation.start(size, paysP);
    this.formations.push(formation);
    return formation;
  }
  startBoss(definition: BossDefinition): void {
    this.bosses.push({ tick: this.tick, definition });
  }
  spawnEnemy(event: Readonly<ScriptEvent>, formation: Formation | undefined): boolean {
    this.spawns.push({ tick: this.tick, id: event.archetype.id, x: event.spawn.x });
    this.members.push(formation);
    return true;
  }
}

function play(script: LevelScript, ticks: number): Recorder {
  const director = new LevelDirector(script);
  const recorder = new Recorder();
  for (let i = 1; i <= ticks; i += 1) {
    recorder.tick = i;
    director.tick(recorder);
  }
  return recorder;
}

/** The rows of GDD v0.12 §7.2.1 (Bomb Carrier removed), §7.2.2 and the v0.21 filler rows of §7.2.3, in script order. */
const GDD_ROWS: readonly (readonly [number, string, number, number, number, string])[] = [
  [0, 'popcorn', 8, 80, -8, 'S'],
  [5, 'popcorn', 6, 160, -8, 'S mirrored'],
  [8, 'popcorn', 6, 160, -8, 'S mirrored'],
  [8, 'diver', 1, 80, -8, ''],
  [8, 'diver', 1, 160, -8, ''],
  [10, 'diver', 1, 120, -8, ''],
  [12, 'popcorn', 6, 80, -8, 'S'],
  [15, 'diver', 1, 60, -8, ''],
  [15, 'diver', 1, 180, -8, ''],
  [16, 'popcorn', 6, 120, -8, 'S'],
  [18, 'gunner', 1, -16, 80, '60,80'],
  [18, 'gunner', 1, 256, 80, '180,80'],
  [22, 'popcorn', 8, 120, -8, 'S'],
  [25, 'diver', 1, 80, -8, ''],
  [25, 'diver', 1, 160, -8, ''],
  [26, 'popcorn', 6, 80, -8, 'S mirrored'],
  [28, 'carrier', 1, -16, 64, 'cargo 2'],
  [29, 'diver', 1, 120, -8, ''],
  [32, 'popcorn', 8, 120, -8, 'S'],
  [32, 'gunner', 1, 120, -16, '120,80'],
  [36, 'diver', 1, 60, -8, ''],
  [36, 'diver', 1, 180, -8, ''],
  [38, 'popcorn', 6, 160, -8, 'S mirrored'],
  [40, 'diver', 1, 80, -8, ''],
  [40, 'diver', 1, 160, -8, ''],
  [42, 'popcorn', 6, 80, -8, 'S'],
  [44, 'diver', 1, 60, -8, ''],
  [44, 'diver', 1, 180, -8, ''],
  [45, 'heavy-ring', 1, 120, -24, '120,72'],
  [50, 'popcorn', 8, 60, -8, 'S'],
  [52, 'popcorn', 6, 180, -8, 'S mirrored'],
  [55, 'popcorn', 6, 120, -8, 'S'],
  [57, 'diver', 1, 120, -8, ''],
  [58, 'diver', 1, 60, -8, ''],
  [58, 'diver', 1, 180, -8, ''],
  [59, 'diver', 1, 100, -8, ''],
  [59, 'diver', 1, 140, -8, ''],
  [60, 'popcorn', 6, 80, -8, 'S'],
  [61, 'diver', 1, 80, -8, ''],
  [61, 'diver', 1, 160, -8, ''],
  [62, 'diver', 1, 60, -8, ''],
  [62, 'diver', 1, 180, -8, ''],
  [64, 'gunner', 1, 60, -16, '60,64'],
  [64, 'gunner', 1, 180, -16, '180,64'],
  [66, 'popcorn', 6, 160, -8, 'S mirrored'],
  [68, 'diver', 1, 80, -8, ''],
  [68, 'diver', 1, 160, -8, ''],
  [70, 'popcorn', 8, 120, -8, 'S'],
  [70, 'diver', 1, 40, -8, ''],
  [70, 'diver', 1, 200, -8, ''],
  [74, 'popcorn', 8, 80, -8, 'S'],
  [75, 'diver', 1, 60, -8, ''],
  [75, 'diver', 1, 180, -8, ''],
  [76, 'diver', 1, 120, -8, ''],
  [77, 'popcorn', 6, 120, -8, 'S'],
  [78, 'carrier', 1, -16, 48, 'cargo 4'],
  [80, 'diver', 1, 100, -8, ''],
  [80, 'diver', 1, 140, -8, ''],
  [82, 'gunner', 1, -16, 72, '48,72'],
  [82, 'gunner', 1, 256, 72, '192,72'],
  [82, 'gunner', 1, 120, -16, '120,56'],
  [86, 'popcorn', 6, 160, -8, 'S mirrored'],
  [88, 'diver', 1, 120, -8, ''],
  [88, 'popcorn', 6, 80, -8, 'S'],
  [90, 'heavy-fan', 1, 120, -24, '120,72'],
  [92, 'diver', 1, 60, -8, ''],
  [93, 'diver', 1, 180, -8, ''],
  [95, 'popcorn', 8, 120, -8, 'S'],
  [98, 'diver', 1, 60, -8, ''],
  [98, 'diver', 1, 180, -8, ''],
  [99, 'popcorn', 6, 80, -8, 'S'],
  [101, 'diver', 1, 120, -8, ''],
  [102, 'heavy-ring', 1, 60, -24, '60,80'],
  [102, 'heavy-fan', 1, 180, -24, '180,80'],
  [107, 'diver', 1, 100, -8, ''],
  [107, 'diver', 1, 140, -8, ''],
  [109, 'diver', 1, 60, -8, ''],
  [109, 'diver', 1, 180, -8, ''],
  [110, 'popcorn', 8, 120, -8, 'S'],
];

describe('LEVEL_1 — the 120 s script of GDD v0.12 §7.2.1, §7.2.2 and v0.21 §7.2.3', () => {
  it('holds exactly the GDD rows, in order', () => {
    const rows = LEVEL_1.events.map((e) => {
      let path = '';
      if (e.archetype.formation) path = e.mirror === true ? 'S mirrored' : 'S';
      else if (e.cargo !== undefined) path = `cargo ${String(e.cargo)}`;
      else if (e.hover !== undefined) path = `${String(e.hover.x)},${String(e.hover.y)}`;
      return [e.at, e.archetype.id, e.count, e.spawn.x, e.spawn.y, path];
    });
    expect(rows).toEqual(GDD_ROWS);
  });

  it('pins the P of each formation: only 0, 32 and 110 s pay it (GDD v0.18, v0.21 §7.2.3)', () => {
    const formations = LEVEL_1.events.filter((e) => e.archetype.formation && e.count > 1);
    expect(formations.map((e) => [e.at, e.paysP !== false])).toEqual([
      [0, true],
      [5, false],
      [8, false],
      [12, false],
      [16, false],
      [22, false],
      [26, false],
      [32, true],
      [38, false],
      [42, false],
      [50, false],
      [52, false],
      [55, false],
      [60, false],
      [66, false],
      [70, false],
      [74, false],
      [77, false],
      [86, false],
      [88, false],
      [95, false],
      [99, false],
      [110, true],
    ]);
    // The flag lives on formation rows only (a load check), so no other row carries one.
    expect(LEVEL_1.events.filter((e) => e.paysP !== undefined).map((e) => e.at)).toEqual([
      5, 8, 12, 16, 22, 26, 38, 42, 50, 52, 55, 60, 66, 70, 74, 77, 86, 88, 95, 99,
    ]);
  });

  it('hands each formation of a pass its row flag when the director starts it', () => {
    const recorder = play(LEVEL_1, 7200);
    expect(recorder.formations.map((formation) => formation.paysP)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('spaces every group member 1/3 s apart', () => {
    const groups = LEVEL_1.events.filter((e) => e.count > 1);
    expect(groups.every((e) => e.interval === 1 / 3)).toBe(true);
  });

  it('carries one 1-UP Carrier and no Bomb Carrier; its Heavies are the Bomb source', () => {
    const cargo = LEVEL_1.events.filter((e) => e.cargo !== undefined).map((e) => e.cargo);
    expect(cargo).toEqual([PickupKind.Shield, PickupKind.OneUp]);
  });

  it('puts every Heavy straight above its hover point, fully above the field', () => {
    const heavies = LEVEL_1.events.filter((e) => e.archetype.id.startsWith('heavy'));
    expect(heavies).toHaveLength(4);
    for (const heavy of heavies) {
      expect(heavy.spawn.x).toBe(heavy.hover?.x);
      expect(heavy.spawn.y + heavy.archetype.stats.height / 2).toBeLessThanOrEqual(0);
    }
  });

  it('ends in the Cruiser at 120 s, and no longer loops', () => {
    expect(LEVEL_1.warningAt).toBe(120);
    expect(LEVEL_1.boss).toBe(CRUISER);
    expect('loopAt' in LEVEL_1).toBe(false);
  });
});

describe('LevelDirector — script walking (GDD v0.6 §7.2.1, class diagram)', () => {
  it('spawns the 0 s row on the first step: 8 Popcorn (GDD v0.11), one every 1/3 s (20 steps)', () => {
    const ticks = play(LEVEL_1, 480)
      .spawns.filter((s) => s.id === 'popcorn' && s.x === 80)
      .map((s) => s.tick);
    expect(ticks).toEqual([1, 21, 41, 61, 81, 101, 121, 141]);
  });

  it('spawns the 50 s formation of 8 Popcorn (GDD v0.11) from step 3001, 20 steps apart', () => {
    const ticks = play(LEVEL_1, 3120)
      .spawns.filter((s) => s.tick > 3000 && s.id === 'popcorn')
      .map((s) => s.tick);
    expect(ticks).toEqual([3001, 3021, 3041, 3061, 3081, 3101]);
    const all = play(LEVEL_1, 3180).spawns.filter((s) => s.tick > 3000 && s.tick <= 3180);
    expect(all.filter((s) => s.id === 'popcorn' && s.x === 60)).toHaveLength(8);
  });

  it('spawns the two lone Divers of GDD v0.11 at 92 s (x 60) and 93 s (x 180), in no formation', () => {
    const recorder = play(LEVEL_1, 5640);
    const late = recorder.spawns
      .map((s, i) => ({ ...s, member: recorder.members[i] }))
      .filter((s) => s.tick > 5520 && s.tick <= 5640);
    expect(late.map((s) => `${s.id}@${String(s.x)}:${String(s.tick)}`)).toEqual([
      'diver@60:5521',
      'diver@180:5581',
    ]);
    expect(late.every((s) => s.member === undefined)).toBe(true);
  });

  it('spawns the 8 s rows on step 481, in script order: Popcorn before the two Divers', () => {
    const at8 = play(LEVEL_1, 481).spawns.filter((s) => s.tick === 481);
    expect(at8.map((s) => `${s.id}@${String(s.x)}`)).toEqual([
      'popcorn@160',
      'diver@80',
      'diver@160',
    ]);
  });

  it('starts the boss once, on the step that reaches 120 s, and spawns nothing after it', () => {
    const early = play(LEVEL_1, 7200);
    expect(early.bosses).toEqual([]);
    const recorder = play(LEVEL_1, 3 * 7200);
    expect(recorder.bosses).toHaveLength(1);
    expect(recorder.bosses[0]?.tick).toBe(7201);
    expect(recorder.bosses[0]?.definition).toBe(CRUISER);
    expect(recorder.spawns.filter((s) => s.tick > 7200)).toEqual([]);
  });

  it('spawns its last member, the 110 s formation eighth member, at 112.3 s, then nothing', () => {
    const spawns = play(LEVEL_1, 7200).spawns;
    expect(spawns.map((s) => s.tick).slice(-1)).toEqual([6741]);
  });

  // GDD v0.11–v0.12: Popcorn 52, Divers 12; v0.21 §7.2.3 adds the filler rows (no Gunner, Carrier or Heavy).
  it('holds the rows of GDD v0.12 §7.2.1, §7.2.2 and v0.21 §7.2.3 per pass', () => {
    const recorder = play(LEVEL_1, 7200);
    const count = (id: string): number => recorder.spawns.filter((s) => s.id === id).length;
    expect(['popcorn', 'diver', 'gunner', 'carrier', 'heavy-ring', 'heavy-fan'].map(count)).toEqual(
      [154, 42, 8, 2, 2, 2],
    );
  });

  it.each([
    ['a group without an interval', { at: 0, archetype: DIVER, count: 2, spawn: { x: 0, y: 0 } }],
    [
      'one enemy with an interval',
      { at: 0, archetype: GUNNER, count: 1, interval: 1, spawn: { x: 0, y: 0 } },
    ],
    [
      'a Popcorn formation of 3',
      { at: 0, archetype: POPCORN, count: 3, interval: 1, spawn: { x: 0, y: 0 } },
    ],
    ['a negative time', { at: -1, archetype: DIVER, count: 1, spawn: { x: 0, y: 0 } }],
    [
      'a time that is not a number',
      { at: Number.NaN, archetype: DIVER, count: 1, spawn: { x: 0, y: 0 } },
    ],
    [
      'an interval that is not a number',
      { at: 0, archetype: POPCORN, count: 6, interval: Number.NaN, spawn: { x: 0, y: 0 } },
    ],
    [
      'an interval that rounds to 0 steps',
      { at: 0, archetype: POPCORN, count: 6, interval: 0.001, spawn: { x: 0, y: 0 } },
    ],
  ])('rejects %s at load (RangeError)', (_label, event) => {
    expect(() => new LevelDirector(testScript([event]))).toThrow(RangeError);
  });

  it('accepts a spawn just before warningAt − 4 s and rejects one at it (RangeError)', () => {
    const row = (at: number): ScriptEvent => ({
      at,
      archetype: DIVER,
      count: 1,
      spawn: { x: 0, y: 0 },
    });
    expect(() => new LevelDirector(testScript([row(115.98)], { warningAt: 120 }))).not.toThrow();
    expect(() => new LevelDirector(testScript([row(116)], { warningAt: 120 }))).toThrow(RangeError);
    // The last member of a group counts, not its first.
    const group: ScriptEvent = {
      at: 110,
      archetype: POPCORN,
      count: 8,
      interval: 1,
      spawn: { x: 0, y: 0 },
    };
    expect(() => new LevelDirector(testScript([group], { warningAt: 120 }))).toThrow(RangeError);
  });

  it('rejects a warningAt that is not a time after the 4 s drain (RangeError)', () => {
    expect(() => new LevelDirector(testScript([], { warningAt: 4 }))).toThrow(RangeError);
    expect(() => new LevelDirector(testScript([], { warningAt: Number.NaN }))).toThrow(RangeError);
  });

  it('accepts a lone Popcorn, which never forms a formation', () => {
    expect(
      () =>
        new LevelDirector(
          testScript([{ at: 0, archetype: POPCORN, count: 1, spawn: { x: 0, y: 0 } }]),
        ),
    ).not.toThrow();
  });
});

describe('LevelDirector — load checks name their rule (class diagram rule table)', () => {
  const SPAWN = { x: 0, y: 0 };
  const load = (event: ScriptEvent, overrides: Partial<LevelScript> = {}): LevelDirector =>
    new LevelDirector(testScript([event], overrides));

  it.each([
    ['a negative time', -1],
    ['a time that is not a number', Number.NaN],
    ['an infinite time', Number.POSITIVE_INFINITY],
  ])('rejects %s with the time rule', (_label, at) => {
    expect(() => load({ at, archetype: DIVER, count: 1, spawn: SPAWN })).toThrow(
      /needs a time of 0 s or more/,
    );
  });

  it('accepts a row at exactly 0 s: the time rule is "0 s or more"', () => {
    expect(() => load({ at: 0, archetype: DIVER, count: 1, spawn: SPAWN })).not.toThrow();
  });

  it.each([
    ['0', 0],
    ['a negative count', -1],
    ['a fractional count', 1.5],
    ['a count that is not a number', Number.NaN],
  ])('rejects a count of %s with the positive-whole-count rule', (_label, count) => {
    expect(() => load({ at: 0, archetype: DIVER, count, spawn: SPAWN })).toThrow(
      /needs a positive whole count/,
    );
  });

  it('rejects one enemy with an interval, naming the rule', () => {
    expect(() => load({ at: 0, archetype: GUNNER, count: 1, interval: 1, spawn: SPAWN })).toThrow(
      /is one enemy, it takes no interval/,
    );
  });

  it.each([
    ['an interval that is not a number', Number.NaN],
    ['an infinite interval', Number.POSITIVE_INFINITY],
    ['an interval that rounds to 0 steps', 0.001],
    ['a 0 interval', 0],
  ])('rejects a group with %s, naming the interval rule', (_label, interval) => {
    expect(() => load({ at: 0, archetype: GUNNER, count: 2, interval, spawn: SPAWN })).toThrow(
      /is a group, it needs an interval/,
    );
  });

  it('rejects a group with no interval, naming the interval rule', () => {
    expect(() => load({ at: 0, archetype: GUNNER, count: 2, spawn: SPAWN })).toThrow(
      /is a group, it needs an interval/,
    );
  });

  it('accepts a group whose interval is exactly one step (1/60 s)', () => {
    expect(() =>
      load({ at: 0, archetype: GUNNER, count: 2, interval: 1 / 60, spawn: SPAWN }),
    ).not.toThrow();
  });

  it.each([4, 9])('rejects a Popcorn formation of %d, naming the 5 to 8 rule', (count) => {
    expect(() => load({ at: 0, archetype: POPCORN, count, interval: 1, spawn: SPAWN })).toThrow(
      /forms a formation of 5 to 8/,
    );
  });

  it.each([5, 8])('accepts a Popcorn formation of %d, the bounds of the 5 to 8 rule', (count) => {
    expect(() =>
      load({ at: 0, archetype: POPCORN, count, interval: 1, spawn: SPAWN }),
    ).not.toThrow();
  });

  it('applies the formation size to formation roles only: nine Gunners are a plain group', () => {
    expect(() =>
      load({ at: 0, archetype: GUNNER, count: 9, interval: 1, spawn: SPAWN }),
    ).not.toThrow();
  });

  // warningAt 120 s: the last spawn must be before step 7200 − 240 = 6960.
  it.each([
    ['a lone row at 116 s', { at: 116, archetype: DIVER, count: 1, spawn: SPAWN }, false],
    ['a lone row at 115.98 s', { at: 115.98, archetype: DIVER, count: 1, spawn: SPAWN }, true],
    // The last member is at + (count − 1) × interval: 112 s + 4 × 1 s = 116 s.
    [
      'five members from 112 s, the last at 116 s',
      { at: 112, archetype: POPCORN, count: 5, interval: 1, spawn: SPAWN },
      false,
    ],
    [
      'five members from 111.98 s, the last just before 116 s',
      { at: 111.98, archetype: POPCORN, count: 5, interval: 1, spawn: SPAWN },
      true,
    ],
  ])('judges the last spawn against warningAt − 4 s: %s', (_label, event, accepted) => {
    const build = (): LevelDirector => load(event, { warningAt: 120 });
    if (accepted) expect(build).not.toThrow();
    else expect(build).toThrow(/spawns at or after warningAt/);
  });

  it.each([
    ['4 s', 4],
    ['not a number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('rejects a warningAt of %s with the drain rule', (_label, warningAt) => {
    expect(() => new LevelDirector(testScript([], { warningAt }))).toThrow(
      /warningAt must be later than 4 s/,
    );
  });

  it('accepts a warningAt just after the 4 s drain', () => {
    expect(() => new LevelDirector(testScript([], { warningAt: 4.5 }))).not.toThrow();
  });

  it('accepts paysP on a formation row, true or false, and a row without it', () => {
    const row = { at: 0, archetype: POPCORN, count: 5, interval: 1 / 3, spawn: SPAWN };
    expect(() => load({ ...row, paysP: false })).not.toThrow();
    expect(() => load({ ...row, paysP: true })).not.toThrow();
    expect(() => load(row)).not.toThrow();
  });

  it('rejects a paysP that is not a boolean, and one on a row that is no formation', () => {
    const row = { at: 0, archetype: POPCORN, count: 5, interval: 1 / 3, spawn: SPAWN };
    expect(() => load({ ...row, paysP: 0 as unknown as boolean })).toThrow(
      /needs a true or false paysP/,
    );
    expect(() => load({ at: 0, archetype: DIVER, count: 1, spawn: SPAWN, paysP: false })).toThrow(
      /is not a formation, it has no P to pay/,
    );
    expect(() => load({ at: 0, archetype: POPCORN, count: 1, spawn: SPAWN, paysP: false })).toThrow(
      /is not a formation/,
    );
  });

  it('rejects a Carrier row without a cargo, and a cargo on any other role', () => {
    expect(() => load({ at: 0, archetype: CARRIER, count: 1, spawn: { x: -16, y: 64 } })).toThrow(
      /is a Carrier, it needs a cargo/,
    );
    expect(() =>
      load({ at: 0, archetype: DIVER, count: 1, spawn: SPAWN, cargo: PickupKind.Bomb }),
    ).toThrow(/cannot carry a cargo/);
  });

  it('rejects a Carrier that starts on the field or never crosses it', () => {
    const cargo = PickupKind.Bomb;
    expect(() =>
      load({ at: 0, archetype: CARRIER, count: 1, spawn: { x: 120, y: 64 }, cargo }),
    ).toThrow(/must spawn outside the field/);
    expect(() =>
      load({ at: 0, archetype: CARRIER, count: 1, spawn: { x: -16, y: -40 }, cargo }),
    ).toThrow(/must cross the field/);
  });
});

describe('LevelDirector — which rows form a formation (class diagram)', () => {
  it('gives a lone Popcorn and a group of Gunners no formation', () => {
    const script = testScript([
      { at: 0, archetype: POPCORN, count: 1, spawn: { x: 0, y: 0 } },
      { at: 0, archetype: GUNNER, count: 2, interval: 1, spawn: { x: 0, y: 0 } },
    ]);
    const recorder = play(script, 100);
    expect(recorder.formations).toHaveLength(0);
    expect(recorder.members).toEqual([undefined, undefined, undefined]);
  });

  it('starts a formation that pays its P unless the row sets paysP to false', () => {
    const script = testScript([
      { at: 0, archetype: POPCORN, count: 5, interval: 1 / 3, spawn: { x: 0, y: 0 } },
      { at: 1, archetype: POPCORN, count: 5, interval: 1 / 3, spawn: { x: 0, y: 0 }, paysP: false },
      { at: 2, archetype: POPCORN, count: 5, interval: 1 / 3, spawn: { x: 0, y: 0 }, paysP: true },
    ]);
    const recorder = play(script, 300);
    expect(recorder.formations.map((formation) => formation.paysP)).toEqual([true, false, true]);
  });

  it('gives a Popcorn group of 2 or more the formation of its pass', () => {
    const script = testScript([
      { at: 0, archetype: POPCORN, count: 5, interval: 1 / 3, spawn: { x: 0, y: 0 } },
    ]);
    const recorder = play(script, 100);
    expect(recorder.formations).toHaveLength(1);
    expect(recorder.members.every((member) => member === recorder.formations[0])).toBe(true);
  });
});
