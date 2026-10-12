import type { Vec2 } from './geometry';

/** What the run tells its listeners (class diagram, ADR-0010, ADR-0019); built so far. */
export const GameEventKind = {
  EnemyHit: 0,
  EnemyDestroyed: 1,
  PlayerDied: 2,
  /** `detail` = pickup kind; published only for a pickup that exists. */
  PickupSpawned: 3,
  /** `detail` = pickup kind, `value` = the cap bonus (0 or 1 000). */
  PickupCollected: 4,
  /** A whole Popcorn formation destroyed; `position` = its last member. */
  FormationCleared: 5,
  /** The shield absorbed a hit; `position` = the ship. */
  PlayerHit: 6,
  /** A bomb went off; `position` = the ship. */
  BombUsed: 7,
} as const;
export type GameEventKind = (typeof GameEventKind)[keyof typeof GameEventKind];

const KIND_COUNT = Object.keys(GameEventKind).length;

/**
 * One reusable event object per kind (ADR-0010): `subject` is the serial of a live body,
 * `ENEMY_DESTROYED` carries its position, `value` = score and `detail` = size tier, so no handler
 * looks the body up after it is released.
 */
export interface GameEvent {
  readonly kind: GameEventKind;
  readonly position: Vec2;
  value: number;
  subject: number;
  detail: number;
}

export type GameEventHandler = (event: Readonly<GameEvent>) => void;
export type Unsubscribe = () => void;

/** The subscribe-only view handed to listeners that must never publish (the presenter). */
export interface RunEvents {
  subscribe(kind: GameEventKind, handler: GameEventHandler): void;
}

export function createGameEvent(kind: GameEventKind): GameEvent {
  return { kind, position: { x: 0, y: 0 }, value: 0, subject: 0, detail: 0 };
}

/**
 * The per-run event bus (ADR-0003, ADR-0010): synchronous, in subscription order. Publishing a
 * kind while it is being dispatched throws, so a handler can never overwrite the event it reads.
 */
export class EventBus implements RunEvents {
  private readonly handlers: GameEventHandler[][] = [];
  private dispatching = 0;

  constructor() {
    for (let kind = 0; kind < KIND_COUNT; kind += 1) this.handlers.push([]);
  }

  /**
   * Unsubscribing from inside a handler of the same kind would skip the next handler of that
   * dispatch: nothing does it, and `Run` never unsubscribes (the bus dies with its run).
   */
  subscribe(kind: GameEventKind, handler: GameEventHandler): Unsubscribe {
    const list = this.listOf(kind);
    list.push(handler);
    return () => {
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    };
  }

  publish(event: Readonly<GameEvent>): void {
    const bit = 1 << event.kind;
    if ((this.dispatching & bit) !== 0) {
      throw new Error(`EventBus: re-entrant publish of kind ${String(event.kind)}`);
    }
    const list = this.listOf(event.kind);
    this.dispatching |= bit;
    try {
      for (let i = 0; i < list.length; i += 1) list[i]?.(event);
    } finally {
      this.dispatching &= ~bit;
    }
  }

  // An unknown kind fails closed: a handler is never dropped in silence.
  private listOf(kind: GameEventKind): GameEventHandler[] {
    const list = this.handlers[kind];
    if (list === undefined) throw new RangeError(`EventBus: unknown event kind ${String(kind)}`);
    return list;
  }
}
