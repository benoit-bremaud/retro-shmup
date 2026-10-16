import type { BossDefinition } from './boss';
import { CRUISER } from './cruiser';
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
  /**
   * Only on a formation row: whether the full formation pays its P (GDD v0.12 §4.6, §7.2). Absent
   * means true. A false row still spawns, scores and counts in the tally.
   */
  readonly paysP?: boolean;
}

/**
 * A level script (04-class-domain): its rows, the second the waves stop and the boss starts, the
 * boss itself, and the colour of a full formation's P. A script ends in its boss, never loops
 * (ADR-0022 decision 4).
 */
export interface LevelScript {
  readonly events: readonly ScriptEvent[];
  /**
   * Seconds from the start: the waves stop and the `LevelDirector` starts `boss` (GDD v0.10 §6).
   * No row may spawn at or after `warningAt` − 4 s, a load check. That check alone does not keep
   * the field clear: a Heavy stays about 14 s, so a script must also leave the field empty when
   * the WARNING starts, or a wave enemy could fire during the end of the boss fight, which the
   * GDD (§6) promises cannot kill the ship. The level simulation asserts it for each level.
   */
  readonly warningAt: number;
  readonly boss: BossDefinition;
  /** The colour of a full formation's P (GDD v0.8 §4.6): red in level 1. */
  readonly dominantColour: PickupKind;
}

const POPCORN_INTERVAL = 1 / 3;

/**
 * Level 1 (GDD v0.18 §7.2.1, §7.2.2, and the v0.21 filler rows of §7.2.3, none paying a P; of
 * §7.2.1–§7.2.2 the formations at 8, 50, 52 and 70 s pay no P): the opening,
 * then the ramp to the 102 s Heavy pair, the last spawn at 112.3 s and the field draining until
 * the WARNING at 120 s, then the Cruiser.
 */
export const LEVEL_1: LevelScript = {
  warningAt: 120,
  boss: CRUISER,
  dominantColour: PickupKind.PRed,
  events: [
    // The opening (§7.2.1).
    { at: 0, archetype: POPCORN, count: 8, interval: POPCORN_INTERVAL, spawn: { x: 80, y: -8 } },
    {
      at: 5,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 160, y: -8 },
      mirror: true,
      paysP: false,
    },
    {
      at: 8,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 160, y: -8 },
      mirror: true,
      paysP: false,
    },
    { at: 8, archetype: DIVER, count: 1, spawn: { x: 80, y: -8 } },
    { at: 8, archetype: DIVER, count: 1, spawn: { x: 160, y: -8 } },
    { at: 10, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    {
      at: 12,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 80, y: -8 },
      paysP: false,
    },
    { at: 15, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 15, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    {
      at: 16,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 120, y: -8 },
      paysP: false,
    },
    { at: 18, archetype: GUNNER, count: 1, spawn: { x: -16, y: 80 }, hover: { x: 60, y: 80 } },
    { at: 18, archetype: GUNNER, count: 1, spawn: { x: 256, y: 80 }, hover: { x: 180, y: 80 } },
    {
      at: 22,
      archetype: POPCORN,
      count: 8,
      interval: POPCORN_INTERVAL,
      spawn: { x: 120, y: -8 },
      paysP: false,
    },
    { at: 25, archetype: DIVER, count: 1, spawn: { x: 80, y: -8 } },
    { at: 25, archetype: DIVER, count: 1, spawn: { x: 160, y: -8 } },
    {
      at: 26,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 80, y: -8 },
      mirror: true,
      paysP: false,
    },
    { at: 28, archetype: CARRIER, count: 1, spawn: { x: -16, y: 64 }, cargo: PickupKind.Shield },
    { at: 29, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    { at: 32, archetype: POPCORN, count: 8, interval: POPCORN_INTERVAL, spawn: { x: 120, y: -8 } },
    { at: 32, archetype: GUNNER, count: 1, spawn: { x: 120, y: -16 }, hover: { x: 120, y: 80 } },
    // The ramp (§7.2.2).
    { at: 36, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 36, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    {
      at: 38,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 160, y: -8 },
      mirror: true,
      paysP: false,
    },
    { at: 40, archetype: DIVER, count: 1, spawn: { x: 80, y: -8 } },
    { at: 40, archetype: DIVER, count: 1, spawn: { x: 160, y: -8 } },
    {
      at: 42,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 80, y: -8 },
      paysP: false,
    },
    { at: 44, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 44, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    {
      at: 45,
      archetype: HEAVY_RING,
      count: 1,
      spawn: { x: 120, y: -24 },
      hover: { x: 120, y: 72 },
    },
    {
      at: 50,
      archetype: POPCORN,
      count: 8,
      interval: POPCORN_INTERVAL,
      spawn: { x: 60, y: -8 },
      paysP: false,
    },
    {
      at: 52,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 180, y: -8 },
      mirror: true,
      paysP: false,
    },
    {
      at: 55,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 120, y: -8 },
      paysP: false,
    },
    { at: 57, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    { at: 58, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 58, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    { at: 59, archetype: DIVER, count: 1, spawn: { x: 100, y: -8 } },
    { at: 59, archetype: DIVER, count: 1, spawn: { x: 140, y: -8 } },
    {
      at: 60,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 80, y: -8 },
      paysP: false,
    },
    { at: 61, archetype: DIVER, count: 1, spawn: { x: 80, y: -8 } },
    { at: 61, archetype: DIVER, count: 1, spawn: { x: 160, y: -8 } },
    { at: 62, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 62, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    { at: 64, archetype: GUNNER, count: 1, spawn: { x: 60, y: -16 }, hover: { x: 60, y: 64 } },
    { at: 64, archetype: GUNNER, count: 1, spawn: { x: 180, y: -16 }, hover: { x: 180, y: 64 } },
    // GDD v0.18: the 70 s formation no longer pays its P.
    {
      at: 66,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 160, y: -8 },
      mirror: true,
      paysP: false,
    },
    { at: 68, archetype: DIVER, count: 1, spawn: { x: 80, y: -8 } },
    { at: 68, archetype: DIVER, count: 1, spawn: { x: 160, y: -8 } },
    {
      at: 70,
      archetype: POPCORN,
      count: 8,
      interval: POPCORN_INTERVAL,
      spawn: { x: 120, y: -8 },
      paysP: false,
    },
    { at: 70, archetype: DIVER, count: 1, spawn: { x: 40, y: -8 } },
    { at: 70, archetype: DIVER, count: 1, spawn: { x: 200, y: -8 } },
    {
      at: 74,
      archetype: POPCORN,
      count: 8,
      interval: POPCORN_INTERVAL,
      spawn: { x: 80, y: -8 },
      paysP: false,
    },
    { at: 75, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 75, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    { at: 76, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    {
      at: 77,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 120, y: -8 },
      paysP: false,
    },
    { at: 78, archetype: CARRIER, count: 1, spawn: { x: -16, y: 48 }, cargo: PickupKind.OneUp },
    { at: 80, archetype: DIVER, count: 1, spawn: { x: 100, y: -8 } },
    { at: 80, archetype: DIVER, count: 1, spawn: { x: 140, y: -8 } },
    { at: 82, archetype: GUNNER, count: 1, spawn: { x: -16, y: 72 }, hover: { x: 48, y: 72 } },
    { at: 82, archetype: GUNNER, count: 1, spawn: { x: 256, y: 72 }, hover: { x: 192, y: 72 } },
    { at: 82, archetype: GUNNER, count: 1, spawn: { x: 120, y: -16 }, hover: { x: 120, y: 56 } },
    {
      at: 86,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 160, y: -8 },
      mirror: true,
      paysP: false,
    },
    { at: 88, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    {
      at: 88,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 80, y: -8 },
      paysP: false,
    },
    { at: 90, archetype: HEAVY_FAN, count: 1, spawn: { x: 120, y: -24 }, hover: { x: 120, y: 72 } },
    { at: 92, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 93, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    {
      at: 95,
      archetype: POPCORN,
      count: 8,
      interval: POPCORN_INTERVAL,
      spawn: { x: 120, y: -8 },
      paysP: false,
    },
    { at: 98, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 98, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    {
      at: 99,
      archetype: POPCORN,
      count: 6,
      interval: POPCORN_INTERVAL,
      spawn: { x: 80, y: -8 },
      paysP: false,
    },
    { at: 101, archetype: DIVER, count: 1, spawn: { x: 120, y: -8 } },
    { at: 102, archetype: HEAVY_RING, count: 1, spawn: { x: 60, y: -24 }, hover: { x: 60, y: 80 } },
    {
      at: 102,
      archetype: HEAVY_FAN,
      count: 1,
      spawn: { x: 180, y: -24 },
      hover: { x: 180, y: 80 },
    },
    { at: 107, archetype: DIVER, count: 1, spawn: { x: 100, y: -8 } },
    { at: 107, archetype: DIVER, count: 1, spawn: { x: 140, y: -8 } },
    { at: 109, archetype: DIVER, count: 1, spawn: { x: 60, y: -8 } },
    { at: 109, archetype: DIVER, count: 1, spawn: { x: 180, y: -8 } },
    { at: 110, archetype: POPCORN, count: 8, interval: POPCORN_INTERVAL, spawn: { x: 120, y: -8 } },
  ],
};
