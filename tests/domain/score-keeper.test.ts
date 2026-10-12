import { describe, expect, it } from 'vitest';
import { createGameEvent, EventBus, GameEventKind } from '../../src/domain/game/events';
import { ScoreKeeper } from '../../src/domain/game/score-keeper';

function setup(): { bus: EventBus; keeper: ScoreKeeper; kill: (value?: number) => void } {
  const bus = new EventBus();
  const keeper = new ScoreKeeper(bus);
  const destroyed = createGameEvent(GameEventKind.EnemyDestroyed);
  const kill = (value = 100): void => {
    destroyed.value = value;
    bus.publish(destroyed);
  };
  return { bus, keeper, kill };
}

/** `steps` fixed steps without a kill, as `Run.step` ticks the keeper at step 7. */
function wait(keeper: ScoreKeeper, steps: number): void {
  for (let i = 0; i < steps; i += 1) keeper.tick();
}

/** A kill at step 5 then the tick of step 7, as in one `Run.step`. */
function killStep(keeper: ScoreKeeper, kill: (value?: number) => void, value = 100): void {
  kill(value);
  keeper.tick();
}

describe('ScoreKeeper — points and chain (GDD §8)', () => {
  it('scores a kill at its base value at ×1', () => {
    const { keeper, kill } = setup();
    killStep(keeper, kill, 150);
    expect(keeper.score).toBe(150);
    expect(keeper.multiplier).toBe(1);
  });

  it('scores the 5th chained kill at ×1 and the 6th at ×2', () => {
    const { keeper, kill } = setup();
    for (let i = 0; i < 5; i += 1) killStep(keeper, kill);
    expect(keeper.score).toBe(500);
    killStep(keeper, kill);
    expect(keeper.score).toBe(700);
  });

  it('extends the chain with a kill exactly 120 steps later; 121 steps breaks it', () => {
    const extended = setup();
    for (let i = 0; i < 5; i += 1) killStep(extended.keeper, extended.kill);
    wait(extended.keeper, 119);
    killStep(extended.keeper, extended.kill); // 120 steps after the previous kill
    expect(extended.keeper.score).toBe(700);

    const broken = setup();
    for (let i = 0; i < 5; i += 1) killStep(broken.keeper, broken.kill);
    wait(broken.keeper, 120);
    killStep(broken.keeper, broken.kill); // 121 steps after
    expect(broken.keeper.score).toBe(600);
    expect(broken.keeper.multiplier).toBe(1);
  });

  it('caps the multiplier at ×8', () => {
    const { keeper, kill } = setup();
    for (let i = 0; i < 50; i += 1) killStep(keeper, kill);
    expect(keeper.multiplier).toBe(8);
  });

  it('resets the chain and empties the bar on death', () => {
    const { bus, keeper, kill } = setup();
    for (let i = 0; i < 7; i += 1) killStep(keeper, kill);
    bus.publish(createGameEvent(GameEventKind.PlayerDied));
    expect(keeper.multiplier).toBe(1);
    expect(keeper.chainRatio).toBe(0);
  });

  it('fills the chain bar after a kill and empties it exactly when the chain breaks', () => {
    const { keeper, kill } = setup();
    expect(keeper.chainRatio).toBe(0);
    killStep(keeper, kill);
    expect(keeper.chainRatio).toBe(1);
    wait(keeper, 119);
    expect(keeper.chainRatio).toBeCloseTo(1 / 120, 9);
    wait(keeper, 1);
    expect(keeper.chainRatio).toBe(0);
  });
});

describe('ScoreKeeper — the boss bonus (GDD v0.10 §6, ADR-0023)', () => {
  function destroyBoss(bus: EventBus, secondsLeft: number): void {
    const destroyed = createGameEvent(GameEventKind.BossDestroyed);
    destroyed.value = secondsLeft;
    bus.publish(destroyed);
  }

  it.each([
    [90, 19000],
    [37, 13700],
    [1, 10100],
    [0, 10000],
  ])('pays 10 000 + 100 × the seconds left: %s s gives %s', (seconds, points) => {
    const { bus, keeper } = setup();
    destroyBoss(bus, seconds);
    expect(keeper.score).toBe(points);
  });

  it('pays flat: never multiplied, and the chain neither extends nor breaks', () => {
    const { bus, keeper, kill } = setup();
    for (let i = 0; i < 10; i += 1) killStep(keeper, kill);
    expect(keeper.multiplier).toBe(3);
    const before = keeper.score;
    wait(keeper, 60);
    destroyBoss(bus, 50);
    expect(keeper.score).toBe(before + 15000);
    expect(keeper.multiplier).toBe(3);
    // 61 steps into the 120-step window, untouched by the bonus: the chain still ends on time.
    expect(keeper.chainRatio).toBeCloseTo(60 / 120, 9);
  });

  it('scores nothing when the boss flees', () => {
    const { bus, keeper } = setup();
    bus.publish(createGameEvent(GameEventKind.BossFled));
    expect(keeper.score).toBe(0);
  });
});

describe('ScoreKeeper — the end-of-level tally (GDD v0.10 §8, ADR-0022 decision 7)', () => {
  it('adds the tally exactly once and flat, even with a chain running at ×3', () => {
    const { bus, keeper, kill } = setup();
    for (let i = 0; i < 10; i += 1) killStep(keeper, kill); // 10 chained kills: ×3 from here
    expect(keeper.multiplier).toBe(3);
    const before = keeper.score;
    const cleared = createGameEvent(GameEventKind.LevelCleared);
    cleared.value = 2; // bombs left
    bus.publish(cleared);
    // No formation, no bomb used, no life lost, 2 bombs left: 5 000 + 10 000 + 2 000, not × 3.
    expect(keeper.score - before).toBe(17000);
    expect(keeper.multiplier).toBe(3);
  });

  function publish(bus: EventBus, kind: GameEventKind, value = 0): void {
    const event = createGameEvent(kind);
    event.value = value;
    bus.publish(event);
  }

  it('owns a LevelTally and adds its total flat, once, at LEVEL_CLEARED', () => {
    const { bus, keeper, kill } = setup();
    for (let i = 0; i < 10; i += 1) killStep(keeper, kill); // the chain at ×3
    const before = keeper.score;
    publish(bus, GameEventKind.FormationCleared);
    publish(bus, GameEventKind.BombUsed);
    expect(keeper.score).toBe(before);
    publish(bus, GameEventKind.LevelCleared, 2);
    expect(keeper.tally.total()).toBe(500 + 10000 + 2000);
    expect(keeper.score).toBe(before + 12500);
    expect(keeper.multiplier).toBe(3); // the chain unchanged
  });
});
