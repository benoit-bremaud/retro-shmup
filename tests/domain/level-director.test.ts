import { describe, expect, it } from 'vitest';
import { DIVER, GUNNER, POPCORN } from '../../src/domain/game/enemy';
import { LevelDirector } from '../../src/domain/game/level-director';
import type { EnemySpawner } from '../../src/domain/game/level-director';
import { LEVEL_1 } from '../../src/domain/game/level-script';
import type { LevelScript, ScriptEvent } from '../../src/domain/game/level-script';

/** Records which archetype spawned on which tick (1 = the run's first step). */
class Recorder implements EnemySpawner {
  tick = 0;
  readonly spawns: { tick: number; id: string; x: number }[] = [];
  spawnEnemy(event: Readonly<ScriptEvent>): void {
    this.spawns.push({ tick: this.tick, id: event.archetype.id, x: event.spawn.x });
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

  it('wraps its time at 45 s: the first Popcorn spawns again on step 2701', () => {
    const recorder = play(LEVEL_1, 2701);
    const firsts = recorder.spawns.filter((s) => s.id === 'popcorn' && s.x === 80);
    expect(firsts.map((s) => s.tick).slice(-1)).toEqual([2701]);
    expect(recorder.spawns.filter((s) => s.tick > 2700)).toHaveLength(1);
  });

  it('holds the rows of GDD §7.2.1: 6 + 6 + 8 Popcorn, 2 Divers, 3 Gunners per pass', () => {
    const recorder = play(LEVEL_1, 2700);
    const count = (id: string): number => recorder.spawns.filter((s) => s.id === id).length;
    expect([count('popcorn'), count('diver'), count('gunner')]).toEqual([20, 2, 3]);
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
      'an interval that rounds to 0 steps',
      { at: 0, archetype: POPCORN, count: 6, interval: 0.001, spawn: { x: 0, y: 0 } },
    ],
    [
      'a group past the loop point',
      { at: 44, archetype: POPCORN, count: 6, interval: 1, spawn: { x: 0, y: 0 } },
    ],
  ])('rejects %s at load (RangeError)', (_label, event) => {
    expect(() => new LevelDirector({ loopAt: 45, events: [event] })).toThrow(RangeError);
  });

  it('accepts a lone Popcorn, which never forms a formation', () => {
    expect(
      () =>
        new LevelDirector({
          events: [{ at: 0, archetype: POPCORN, count: 1, spawn: { x: 0, y: 0 } }],
        }),
    ).not.toThrow();
  });
});
