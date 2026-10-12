import { describe, expect, it } from 'vitest';
import { createGameEvent, EventBus, GameEventKind } from '../../src/domain/game/events';
import type { GameEventKind as Kind } from '../../src/domain/game/events';
import { LevelTally } from '../../src/domain/game/level-tally';

function setup(): { tally: LevelTally; publish: (kind: Kind, value?: number) => void } {
  const bus = new EventBus();
  const tally = new LevelTally(bus);
  const publish = (kind: Kind, value = 0): void => {
    const event = createGameEvent(kind);
    event.value = value;
    bus.publish(event);
  };
  return { tally, publish };
}

describe('LevelTally — the end-of-level lines (GDD v0.10 §8, ADR-0022 decision 7)', () => {
  it('starts a level with no formation, the no-bomb and no-miss bonuses kept, no bomb counted', () => {
    const { tally } = setup();
    expect(tally.formationsCleared).toBe(0);
    expect(tally.bombUsed).toBe(false);
    expect(tally.lifeLost).toBe(false);
    expect(tally.bombsLeft).toBe(0);
    expect(tally.total()).toBe(5000 + 10000);
  });

  it('counts every FORMATION_CLEARED, a bomb-completed formation included, × 500', () => {
    const { tally, publish } = setup();
    publish(GameEventKind.FormationCleared);
    publish(GameEventKind.BombUsed);
    publish(GameEventKind.FormationCleared); // completed by the bomb
    publish(GameEventKind.FormationCleared);
    expect(tally.formationsCleared).toBe(3);
    expect(tally.total()).toBe(3 * 500 + 10000);
  });

  it('loses the no-bomb bonus on any BOMB_USED', () => {
    const { tally, publish } = setup();
    publish(GameEventKind.BombUsed);
    expect(tally.bombUsed).toBe(true);
    expect(tally.total()).toBe(10000);
  });

  it('keeps the no-miss bonus through a shield absorb, loses it on a life lost', () => {
    const { tally, publish } = setup();
    publish(GameEventKind.PlayerHit);
    expect(tally.lifeLost).toBe(false);
    publish(GameEventKind.PlayerDied);
    expect(tally.lifeLost).toBe(true);
    expect(tally.total()).toBe(5000);
  });

  it('counts the bombs left at LEVEL_CLEARED, × 1 000', () => {
    const { tally, publish } = setup();
    publish(GameEventKind.LevelCleared, 2);
    expect(tally.bombsLeft).toBe(2);
    expect(tally.total()).toBe(5000 + 10000 + 2000);
  });

  it('leaves the boss bonus out: BOSS_DESTROYED adds no line', () => {
    const { tally, publish } = setup();
    publish(GameEventKind.BossDestroyed, 60);
    expect(tally.total()).toBe(5000 + 10000);
  });

  it('starts over on reset, for the next level', () => {
    const { tally, publish } = setup();
    publish(GameEventKind.FormationCleared);
    publish(GameEventKind.BombUsed);
    publish(GameEventKind.PlayerDied);
    publish(GameEventKind.LevelCleared, 3);
    tally.reset();
    expect([tally.formationsCleared, tally.bombUsed, tally.lifeLost, tally.bombsLeft]).toEqual([
      0,
      false,
      false,
      0,
    ]);
  });
});
