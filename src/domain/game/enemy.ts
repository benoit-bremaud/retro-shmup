import type { AttackPattern } from './attacks';
import { aimedAttack, fanAttack, NoAttack, ringAttack } from './attacks';
import type { Body } from './body';
import type { Formation } from './formation';
import type { Vec2 } from './geometry';
import type { MovementPattern } from './movements';
import { CrossMovement, DiveMovement, enterHoldLeave, PathMovement } from './movements';
import { PickupKind } from './pickup';
import { EnemyBulletTuning, GunnerTuning, HeavyTuning } from './tuning';

/** Size tier of a role (GDD §5.2): it scales the explosion. */
export const SizeTier = {
  Small: 0,
  Medium: 1,
  Large: 2,
} as const;
export type SizeTier = (typeof SizeTier)[keyof typeof SizeTier];

/** Stats of a role (GDD §5.2, v0.6 §5.2.1). Hitboxes are the full sprite box. */
export interface EnemyStats {
  /** In tenths of a level-1 shot (ADR-0019). */
  readonly hp: number;
  readonly width: number;
  readonly height: number;
  readonly score: number;
  readonly tier: SizeTier;
}

/**
 * What a role drops when destroyed (GDD §5.2, ADR-0019): one draw `r` decides, a drop when
 * `r < rate × dropRateScale`, and the same draw picks the kind among `kinds`.
 */
export interface DropTable {
  readonly rate: number;
  readonly kinds: readonly PickupKind[];
}

const NO_DROP: DropTable = { rate: 0, kinds: [] };

/** A role as a data line (GDD §5.3, ADR-0003): stats plus one movement and one attack. */
export interface EnemyArchetype {
  readonly id: 'popcorn' | 'diver' | 'gunner' | 'carrier' | 'heavy-ring' | 'heavy-fan';
  readonly stats: EnemyStats;
  readonly movement: MovementPattern;
  readonly attack: AttackPattern;
  /** Its groups form formations (Popcorn only, GDD §5.2). */
  readonly formation: boolean;
  readonly drops: DropTable;
  /** Its script rows carry a cargo it always drops (Carrier only, GDD v0.8 §5.2.1). */
  readonly carriesCargo: boolean;
}

/** GDD v0.8 §5.2.1: `hp` is in tenths (ADR-0019), so 10 is one level-1 shot, not ten shots. */
export const POPCORN: EnemyArchetype = {
  id: 'popcorn',
  stats: { hp: 10, width: 16, height: 16, score: 100, tier: SizeTier.Small },
  movement: PathMovement,
  attack: NoAttack,
  formation: true,
  drops: NO_DROP,
  carriesCargo: false,
};

/** GDD v0.8 §5.2.1: one shot (`hp` in tenths, ADR-0019), 150 points, dives at the ship. */
export const DIVER: EnemyArchetype = {
  id: 'diver',
  stats: { hp: 10, width: 16, height: 16, score: 150, tier: SizeTier.Small },
  movement: DiveMovement,
  attack: NoAttack,
  formation: false,
  drops: NO_DROP,
  carriesCargo: false,
};

/** GDD v0.8 §5.2.1: 8 shots (`hp` in tenths, ADR-0019); enters, holds, fires aimed bullets. */
export const GUNNER: EnemyArchetype = {
  id: 'gunner',
  stats: { hp: 80, width: 32, height: 32, score: 300, tier: SizeTier.Medium },
  movement: enterHoldLeave({
    travelS: GunnerTuning.travelSeconds,
    holdS: GunnerTuning.holdSeconds,
    leaveSpeed: GunnerTuning.leaveSpeed,
  }),
  attack: aimedAttack({ periodS: GunnerTuning.firePeriodSeconds, speed: EnemyBulletTuning.speed }),
  formation: false,
  // GDD v0.11 §5.2: a P at 10 %, red or blue 50 / 50.
  drops: { rate: 0.1, kinds: [PickupKind.PRed, PickupKind.PBlue] },
  carriesCargo: false,
};

/** GDD v0.8 §5.2.1: 4 shots (`hp` in tenths, ADR-0019); crosses the field with its cargo. */
export const CARRIER: EnemyArchetype = {
  id: 'carrier',
  stats: { hp: 40, width: 32, height: 32, score: 500, tier: SizeTier.Medium },
  movement: CrossMovement,
  attack: NoAttack,
  formation: false,
  // GDD v0.8 §5.2: no roll, its script cargo at 100 %.
  drops: NO_DROP,
  carriesCargo: true,
};

const HEAVY_STATS: EnemyStats = {
  // 40 level-1 shots, in tenths (ADR-0019).
  hp: 400,
  width: 56,
  height: 48,
  score: 1000,
  tier: SizeTier.Large,
};

const HEAVY_MOVEMENT = enterHoldLeave({
  travelS: HeavyTuning.travelSeconds,
  holdS: HeavyTuning.holdSeconds,
  leaveSpeed: HeavyTuning.leaveSpeed,
});

// GDD v0.11 §5.2.1: a Bomb or a Shield at 30 %, 50 / 50, from its one drop draw.
const HEAVY_DROPS: DropTable = { rate: 0.3, kinds: [PickupKind.Bomb, PickupKind.Shield] };

/** The Heavy with the ring (GDD v0.10 §5.2.1): the script row picks ring or fan, never a draw. */
export const HEAVY_RING: EnemyArchetype = {
  id: 'heavy-ring',
  stats: HEAVY_STATS,
  movement: HEAVY_MOVEMENT,
  attack: ringAttack({
    count: HeavyTuning.ringCount,
    periodS: HeavyTuning.volleyPeriodSeconds,
    speed: HeavyTuning.ringSpeed,
    rotateDeg: HeavyTuning.ringRotateDegrees,
  }),
  formation: false,
  drops: HEAVY_DROPS,
  carriesCargo: false,
};

/** The Heavy with the fan (GDD v0.10 §5.2.1). */
export const HEAVY_FAN: EnemyArchetype = {
  id: 'heavy-fan',
  stats: HEAVY_STATS,
  movement: HEAVY_MOVEMENT,
  attack: fanAttack({
    count: HeavyTuning.fanCount,
    spreadDeg: HeavyTuning.fanSpreadDegrees,
    periodS: HeavyTuning.volleyPeriodSeconds,
    speed: HeavyTuning.fanSpeed,
  }),
  formation: false,
  drops: HEAVY_DROPS,
  carriesCargo: false,
};

/** What a spawn reads of a script row. */
export interface SpawnSpec {
  readonly spawn: Readonly<Vec2>;
  readonly hover?: Readonly<Vec2>;
  readonly mirror?: boolean;
  /** What a Carrier drops when destroyed (GDD v0.8 §5.2.1); only Carrier rows carry one. */
  readonly cargo?: PickupKind;
}

/** A pooled enemy (class diagram: «pooled»): a Body plus the archetype it was spawned as. */
export class Enemy implements Body {
  serial = 0;
  readonly position: Vec2 = { x: 0, y: 0 };
  readonly previousPosition: Vec2 = { x: 0, y: 0 };
  readonly velocity: Vec2 = { x: 0, y: 0 };
  readonly origin: Vec2 = { x: 0, y: 0 };
  readonly hover: Vec2 = { x: 0, y: 0 };
  readonly diveTarget: Vec2 = { x: 0, y: 0 };
  width = 0;
  height = 0;
  hp = 0;
  age = 0;
  fireTimer = 0;
  volleys = 0;
  mirror = false;
  entered = false;
  armed = false;
  spent = false;
  archetype: EnemyArchetype = POPCORN;
  /** The Popcorn formation of this pass, if any. */
  formation: Formation | undefined;
  /** Dropped at 100 % when destroyed, instead of the drop table's roll. */
  cargo: PickupKind | undefined;

  /** Resets every field in one place, so a recycled enemy never inherits its predecessor's. */
  spawn(
    archetype: EnemyArchetype,
    spec: Readonly<SpawnSpec>,
    serial: number,
    formation: Formation | undefined,
  ): void {
    this.archetype = archetype;
    this.formation = formation;
    this.cargo = spec.cargo;
    this.serial = serial;
    this.origin.x = spec.spawn.x;
    this.origin.y = spec.spawn.y;
    this.hover.x = spec.hover?.x ?? spec.spawn.x;
    this.hover.y = spec.hover?.y ?? spec.spawn.y;
    this.mirror = spec.mirror ?? false;
    this.position.x = spec.spawn.x;
    this.position.y = spec.spawn.y;
    this.previousPosition.x = spec.spawn.x;
    this.previousPosition.y = spec.spawn.y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.diveTarget.x = 0;
    this.diveTarget.y = 0;
    this.width = archetype.stats.width;
    this.height = archetype.stats.height;
    this.hp = archetype.stats.hp;
    this.age = 0;
    this.fireTimer = 0;
    this.volleys = 0;
    this.entered = false;
    this.armed = false;
    this.spent = false;
  }
}
