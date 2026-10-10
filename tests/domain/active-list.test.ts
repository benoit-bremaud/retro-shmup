import { describe, expect, it } from 'vitest';
import { ActiveList } from '../../src/domain/game/active-list';

interface Item {
  id: number;
  done: boolean;
}

function counting(capacity: number): { list: ActiveList<Item>; created: () => number } {
  let made = 0;
  const list = new ActiveList<Item>(capacity, () => {
    made += 1;
    return { id: made, done: false };
  });
  return { list, created: () => made };
}

function isDone(item: Item): boolean {
  return item.done;
}

function ids(list: ActiveList<Item>): number[] {
  const out: number[] = [];
  for (let i = 0; i < list.count; i += 1) out.push(list.at(i).id);
  return out;
}

describe('ActiveList — preallocated active list over a pool (class diagram notes)', () => {
  it('adds acquired items in order and counts them', () => {
    const { list } = counting(4);
    const first = list.add();
    const second = list.add();
    expect(list.count).toBe(2);
    expect(list.at(0)).toBe(first);
    expect(list.at(1)).toBe(second);
  });

  it('returns undefined when the pool is exhausted, without allocating', () => {
    const { list, created } = counting(2);
    list.add();
    list.add();
    expect(list.add()).toBeUndefined();
    expect(list.count).toBe(2);
    expect(created()).toBe(2);
  });

  it('throws a RangeError outside [0, count)', () => {
    const { list } = counting(2);
    list.add();
    expect(() => list.at(-1)).toThrow(RangeError);
    expect(() => list.at(1)).toThrow(RangeError);
  });

  it('removes several items in one pass, the last one included, and keeps the others', () => {
    const { list } = counting(5);
    for (let i = 0; i < 5; i += 1) {
      const item = list.add();
      if (item !== undefined) item.done = item.id % 2 === 1; // 1, 3 and 5 are done
    }
    list.sweep(isDone);
    expect(ids(list).sort((a, b) => a - b)).toEqual([2, 4]);
  });

  it('releases each removed item exactly once and reuses it for the next add', () => {
    const { list, created } = counting(2);
    const first = list.add();
    list.add();
    if (first !== undefined) first.done = true;
    list.sweep(isDone);
    list.sweep(isDone); // a second sweep finds nothing new: the pool would throw on a double release
    const reused = list.add();
    expect(reused).toBe(first);
    expect(created()).toBe(2);
  });

  it('empties the list when every item is done', () => {
    const { list } = counting(3);
    for (let i = 0; i < 3; i += 1) {
      const item = list.add();
      if (item !== undefined) item.done = true;
    }
    list.sweep(isDone);
    expect(list.count).toBe(0);
  });
});
