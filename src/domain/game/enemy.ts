import type { AttackPattern } from './attacks';
import { AimedAttack, NoAttack } from './attacks';
import type { Body } from './body';
import type { Vec2 } from './geometry';
import type { MovementPattern } from './movements';
import { DiveMovement, EnterHoldLeave, PathMovement } from './movements';

/** Size tier of a role (GDD §5.2): it scales the explosion. */
export const SizeTier = {
  Small: 0,
  Medium: 1,
} as const;
export type SizeTier = (typeof SizeTier)[keyof typeof SizeTier];

/** Stats of a role (GDD §5.2, v0.6 §5.2.1). Hitboxes are the full sprite box. */
export interface EnemyStats {
  readonly hp: number;
  readonly width: number;
  readonly height: number;
  readonly score: number;
  readonly tier: SizeTier;
}

/** A role as a data line (GDD §5.3, ADR-0003): stats plus one movement and one attack. */
export interface EnemyArchetype {
  readonly id: 'popcorn' | 'diver' | 'gunner';
  readonly stats: EnemyStats;
  readonly movement: MovementPattern;
  readonly attack: AttackPattern;
  /** Its groups form formations (Popcorn only, GDD §5.2); used from the pickups brick. */
  readonly formation: boolean;
}

export const POPCORN: EnemyArchetype = {
  id: 'popcorn',
  stats: { hp: 1, width: 16, height: 16, score: 100, tier: SizeTier.Small },
  movement: PathMovement,
  attack: NoAttack,
  formation: true,
};

export const DIVER: EnemyArchetype = {
  id: 'diver',
  stats: { hp: 1, width: 16, height: 16, score: 150, tier: SizeTier.Small },
  movement: DiveMovement,
  attack: NoAttack,
  formation: false,
};

export const GUNNER: EnemyArchetype = {
  id: 'gunner',
  stats: { hp: 8, width: 32, height: 32, score: 300, tier: SizeTier.Medium },
  movement: EnterHoldLeave,
  attack: AimedAttack,
  formation: false,
};

/** What a spawn reads of a script row. */
export interface SpawnSpec {
  readonly spawn: Readonly<Vec2>;
  readonly hover?: Readonly<Vec2>;
  readonly mirror?: boolean;
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
  mirror = false;
  entered = false;
  armed = false;
  spent = false;
  archetype: EnemyArchetype = POPCORN;

  /** Resets every field in one place, so a recycled enemy never inherits its predecessor's. */
  spawn(archetype: EnemyArchetype, spec: Readonly<SpawnSpec>, serial: number): void {
    this.archetype = archetype;
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
    this.entered = false;
    this.armed = false;
    this.spent = false;
  }
}
