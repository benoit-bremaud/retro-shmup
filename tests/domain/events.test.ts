import { describe, expect, it } from 'vitest';
import { createGameEvent, EventBus, GameEventKind } from '../../src/domain/game/events';
import type { GameEventKind as Kind } from '../../src/domain/game/events';

describe('EventBus — per-run, synchronous, ordered (ADR-0003, ADR-0010)', () => {
  it('dispatches in subscription order', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.subscribe(GameEventKind.EnemyDestroyed, () => order.push('score'));
    bus.subscribe(GameEventKind.EnemyDestroyed, () => order.push('presenter'));
    bus.publish(createGameEvent(GameEventKind.EnemyDestroyed));
    expect(order).toEqual(['score', 'presenter']);
  });

  it('throws on a re-entrant publish of the kind being dispatched, then recovers', () => {
    const bus = new EventBus();
    const event = createGameEvent(GameEventKind.EnemyHit);
    const unsubscribe = bus.subscribe(GameEventKind.EnemyHit, () => {
      bus.publish(event);
    });
    expect(() => {
      bus.publish(event);
    }).toThrow(/re-entrant/);
    unsubscribe();
    expect(() => {
      bus.publish(event);
    }).not.toThrow();
  });

  it('fails closed on an unknown kind', () => {
    const bus = new EventBus();
    const unknown = 99 as Kind;
    expect(() => bus.subscribe(unknown, () => undefined)).toThrow(RangeError);
  });

  it('lets a handler publish another kind', () => {
    const bus = new EventBus();
    let heard = false;
    bus.subscribe(GameEventKind.PlayerDied, () => {
      heard = true;
    });
    bus.subscribe(GameEventKind.EnemyDestroyed, () => {
      bus.publish(createGameEvent(GameEventKind.PlayerDied));
    });
    bus.publish(createGameEvent(GameEventKind.EnemyDestroyed));
    expect(heard).toBe(true);
  });
});

describe('EventBus — unsubscribing twice', () => {
  it('leaves the other handlers in place when an unsubscribe is called a second time', () => {
    const bus = new EventBus();
    const heard: string[] = [];
    const first = bus.subscribe(GameEventKind.PlayerDied, () => heard.push('first'));
    bus.subscribe(GameEventKind.PlayerDied, () => heard.push('second'));
    first();
    first();
    bus.publish(createGameEvent(GameEventKind.PlayerDied));
    expect(heard).toEqual(['second']);
  });
});
