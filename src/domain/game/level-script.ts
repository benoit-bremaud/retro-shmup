import { CARRIER, DIVER, GUNNER, POPCORN } from './enemy';
import type { EnemyArchetype, SpawnSpec } from './enemy';
import { PickupKind } from './pickup';

/**
 * One timed row of a level script (GDD §7.1, v0.6 §7.2.1). A group (`count` > 1) spawns one
 * member every `interval` seconds; a one-enemy row has no interval.
 */
export interface ScriptEvent extends SpawnSpec {
  /** Seconds from the start of the script. */
  readonly at: number;
  readonly archetype: EnemyArchetype;
  readonly count: number;
  readonly interval?: number;
}

/**
 * A level script, a subset until the level brick (04-class-domain, brick subsets): its events, the
 * interim `loopAt` and the formation colour; the warning and the boss arrive, required, with the
 * level brick (F).
 */
export interface LevelScript {
  readonly events: readonly ScriptEvent[];
  /** Interim (enemies brick): seconds after which the script time wraps to 0. */
  readonly loopAt?: number;
  /** The colour of a full formation's P (GDD v0.8 §4.6): red in level 1. */
  readonly dominantColour: PickupKind;
}

const POPCORN_INTERVAL = 1 / 3;

/**
 * The first enemy rows of level 1 (GDD v0.8 §7.2.1), looping at 45 s, the Heavy's slot. Interim
 * (meta/05-state-scenes): the Bomb Carrier at 40 s until the level brick brings the Heavy.
 */
export const LEVEL_1: LevelScript = {
  loopAt: 45,
  dominantColour: PickupKind.PRed,
  events: [
    { at: 0, archetype: POPCORN, count: 6, interval: POPCORN_INTERVAL, spawn: { x: 80, y: -8 } },
    {
      at: 8,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 160, y: -8 },
      mirror: true,
    },
    { at: 8, archetype: DIVER, count: 1, spawn: { x: 80, y: -8 } },
    { at: 8, archetype: DIVER, count: 1, spawn: { x: 160, y: -8 } },
    { at: 18, archetype: GUNNER, count: 1, spawn: { x: -16, y: 80 }, hover: { x: 60, y: 80 } },
    { at: 18, archetype: GUNNER, count: 1, spawn: { x: 256, y: 80 }, hover: { x: 180, y: 80 } },
    { at: 28, archetype: CARRIER, count: 1, spawn: { x: -16, y: 64 }, cargo: PickupKind.Shield },
    { at: 32, archetype: POPCORN, count: 8, interval: POPCORN_INTERVAL, spawn: { x: 120, y: -8 } },
    { at: 32, archetype: GUNNER, count: 1, spawn: { x: 120, y: -16 }, hover: { x: 120, y: 80 } },
    { at: 40, archetype: CARRIER, count: 1, spawn: { x: 256, y: 64 }, cargo: PickupKind.Bomb },
  ],
};
