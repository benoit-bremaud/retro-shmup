import { CARRIER, DIVER, GUNNER, HEAVY_FAN, HEAVY_RING, POPCORN } from './enemy';
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
 * Level 1 (GDD v0.10 §7.2.1, §7.2.2): the opening, then the ramp to the 102 s Heavy pair, the
 * last spawn at 112.3 s and the field draining until 120 s. Interim (meta/05-state-scenes, F-1):
 * the script time still wraps at 120 s, the WARNING's slot, until the boss arrives (F-2).
 */
export const LEVEL_1: LevelScript = {
  loopAt: 120,
  dominantColour: PickupKind.PRed,
  events: [
    // The opening (§7.2.1).
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
    // The ramp (§7.2.2).
    { at: 40, archetype: DIVER, count: 1, spawn: { x: 80, y: -8 } },
    { at: 40, archetype: DIVER, count: 1, spawn: { x: 160, y: -8 } },
    {
      at: 45,
      archetype: HEAVY_RING,
      count: 1,
      spawn: { x: 120, y: -24 },
      hover: { x: 120, y: 72 },
    },
    { at: 50, archetype: POPCORN, count: 6, interval: POPCORN_INTERVAL, spawn: { x: 60, y: -8 } },
    {
      at: 52,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 180, y: -8 },
      mirror: true,
    },
    { at: 58, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 58, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    { at: 59, archetype: DIVER, count: 1, spawn: { x: 100, y: -8 } },
    { at: 59, archetype: DIVER, count: 1, spawn: { x: 140, y: -8 } },
    { at: 64, archetype: GUNNER, count: 1, spawn: { x: 60, y: -16 }, hover: { x: 60, y: 64 } },
    { at: 64, archetype: GUNNER, count: 1, spawn: { x: 180, y: -16 }, hover: { x: 180, y: 64 } },
    { at: 70, archetype: POPCORN, count: 8, interval: POPCORN_INTERVAL, spawn: { x: 120, y: -8 } },
    { at: 70, archetype: DIVER, count: 1, spawn: { x: 40, y: -8 } },
    { at: 70, archetype: DIVER, count: 1, spawn: { x: 200, y: -8 } },
    { at: 78, archetype: CARRIER, count: 1, spawn: { x: -16, y: 48 }, cargo: PickupKind.OneUp },
    { at: 82, archetype: GUNNER, count: 1, spawn: { x: -16, y: 72 }, hover: { x: 48, y: 72 } },
    { at: 82, archetype: GUNNER, count: 1, spawn: { x: 256, y: 72 }, hover: { x: 192, y: 72 } },
    { at: 82, archetype: GUNNER, count: 1, spawn: { x: 120, y: -16 }, hover: { x: 120, y: 56 } },
    { at: 90, archetype: HEAVY_FAN, count: 1, spawn: { x: 120, y: -24 }, hover: { x: 120, y: 72 } },
    { at: 92, archetype: POPCORN, count: 6, interval: POPCORN_INTERVAL, spawn: { x: 60, y: -8 } },
    { at: 102, archetype: HEAVY_RING, count: 1, spawn: { x: 60, y: -24 }, hover: { x: 60, y: 80 } },
    {
      at: 102,
      archetype: HEAVY_FAN,
      count: 1,
      spawn: { x: 180, y: -24 },
      hover: { x: 180, y: 80 },
    },
    { at: 110, archetype: POPCORN, count: 8, interval: POPCORN_INTERVAL, spawn: { x: 120, y: -8 } },
  ],
};
