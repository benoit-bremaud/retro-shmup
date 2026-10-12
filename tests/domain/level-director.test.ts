import { describe, expect, it } from 'vitest';
import { DIVER, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import { Formation } from '../../src/domain/game/formation';
import { LevelDirector } from '../../src/domain/game/level-director';
import type { EnemySpawner } from '../../src/domain/game/level-director';
import { LEVEL_1 } from '../../src/domain/game/level-script';
import { PickupKind } from '../../src/domain/game/pickup';
import type { LevelScript, ScriptEvent } from '../../src/domain/game/level-script';

/** Records which archetype spawned on which tick (1 = the run's first step). */
class Recorder implements EnemySpawner {
  tick = 0;
  readonly spawns: { tick: number; id: string; x: number }[] = [];
  readonly formations: Formation[] = [];
  readonly members: (Formation | undefined)[] = [];
  startFormation(size: number): Formation {
    const formation = new Formation();
    formation.start(size);
    this.formations.push(formation);
    return formation;
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

/** The rows of GDD v0.10 §7.2.1 (Bomb Carrier removed) and §7.2.2, as the GDD writes them. */
const GDD_ROWS: readonly (readonly [number, string, number, number, number, string])[] = [
  [0, 'popcorn', 6, 80, -8, 'S'],
  [8, 'popcorn', 6, 160, -8, 'S mirrored'],
  [8, 'diver', 1, 80, -8, ''],
  [8, 'diver', 1, 160, -8, ''],
  [18, 'gunner', 1, -16, 80, '60,80'],
  [18, 'gunner', 1, 256, 80, '180,80'],
  [28, 'carrier', 1, -16, 64, 'cargo 2'],
  [32, 'popcorn', 8, 120, -8, 'S'],
  [32, 'gunner', 1, 120, -16, '120,80'],
  [40, 'diver', 1, 80, -8, ''],
  [40, 'diver', 1, 160, -8, ''],
  [45, 'heavy-ring', 1, 120, -24, '120,72'],
  [50, 'popcorn', 6, 60, -8, 'S'],
  [52, 'popcorn', 6, 180, -8, 'S mirrored'],
  [58, 'diver', 1, 60, -8, ''],
  [58, 'diver', 1, 180, -8, ''],
  [59, 'diver', 1, 100, -8, ''],
  [59, 'diver', 1, 140, -8, ''],
  [64, 'gunner', 1, 60, -16, '60,64'],
  [64, 'gunner', 1, 180, -16, '180,64'],
  [70, 'popcorn', 8, 120, -8, 'S'],
  [70, 'diver', 1, 40, -8, ''],
  [70, 'diver', 1, 200, -8, ''],
  [78, 'carrier', 1, -16, 48, 'cargo 4'],
  [82, 'gunner', 1, -16, 72, '48,72'],
  [82, 'gunner', 1, 256, 72, '192,72'],
  [82, 'gunner', 1, 120, -16, '120,56'],
  [90, 'heavy-fan', 1, 120, -24, '120,72'],
  [92, 'popcorn', 6, 60, -8, 'S'],
  [102, 'heavy-ring', 1, 60, -24, '60,80'],
  [102, 'heavy-fan', 1, 180, -24, '180,80'],
  [110, 'popcorn', 8, 120, -8, 'S'],
];

describe('LEVEL_1 — the 120 s script of GDD v0.10 §7.2.1 and §7.2.2', () => {
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

  it('wraps at 120 s, interim until the WARNING (F-2)', () => {
    expect(LEVEL_1.loopAt).toBe(120);
  });
});

describe('LevelDirector — script walking (GDD v0.6 §7.2.1, class diagram)', () => {
  it('spawns the 0 s row on the first step, one Popcorn every 1/3 s (20 steps)', () => {
    const ticks = play(LEVEL_1, 120)
      .spawns.filter((s) => s.id === 'popcorn')
      .map((s) => s.tick);
    expect(ticks).toEqual([1, 21, 41, 61, 81, 101]);
  });

  it('spawns the 8 s rows on step 481, in script order: Popcorn before the two Divers', () => {
    const at8 = play(LEVEL_1, 481).spawns.filter((s) => s.tick === 481);
    expect(at8.map((s) => `${s.id}@${String(s.x)}`)).toEqual([
      'popcorn@160',
      'diver@80',
      'diver@160',
    ]);
  });

  it('wraps its time at 120 s (interim until the boss): the first Popcorn again on step 7201', () => {
    const recorder = play(LEVEL_1, 7201);
    const firsts = recorder.spawns.filter((s) => s.id === 'popcorn' && s.x === 80);
    expect(firsts.map((s) => s.tick).slice(-1)).toEqual([7201]);
    expect(recorder.spawns.filter((s) => s.tick > 7200)).toHaveLength(1);
  });

  it('spawns its last member, the 110 s formation eighth member, at 112.3 s, then nothing', () => {
    const spawns = play(LEVEL_1, 7200).spawns;
    expect(spawns.map((s) => s.tick).slice(-1)).toEqual([6741]);
  });

  it('holds the rows of GDD v0.10 §7.2.1 and §7.2.2 per pass', () => {
    const recorder = play(LEVEL_1, 7200);
    const count = (id: string): number => recorder.spawns.filter((s) => s.id === id).length;
    expect(['popcorn', 'diver', 'gunner', 'carrier', 'heavy-ring', 'heavy-fan'].map(count)).toEqual(
      [54, 10, 8, 2, 2, 2],
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
    [
      'a group past the loop point',
      { at: 44, archetype: POPCORN, count: 6, interval: 1, spawn: { x: 0, y: 0 } },
    ],
  ])('rejects %s at load (RangeError)', (_label, event) => {
    expect(
      () => new LevelDirector({ loopAt: 45, dominantColour: PickupKind.PRed, events: [event] }),
    ).toThrow(RangeError);
  });

  it('accepts a lone Popcorn, which never forms a formation', () => {
    expect(
      () =>
        new LevelDirector({
          dominantColour: PickupKind.PRed,
          events: [{ at: 0, archetype: POPCORN, count: 1, spawn: { x: 0, y: 0 } }],
        }),
    ).not.toThrow();
  });
});
