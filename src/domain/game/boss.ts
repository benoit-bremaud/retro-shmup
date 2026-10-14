import type { AttackPattern, EnemyShotSpawner } from './attacks';
import type { Body } from './body';
import type { EnemyStats } from './enemy';
import { FIELD_WIDTH, overlapsField } from './geometry';
import type { Vec2 } from './geometry';
import type { MovementPattern, WorldView } from './movements';
import { STEPS_PER_SECOND, toSteps } from './tuning';

/** The lifecycle of a boss (05-state-boss, ADR-0022). */
export const BossState = {
  Idle: 'IDLE',
  Warning: 'WARNING',
  Entering: 'ENTERING',
  Fighting: 'FIGHTING',
  Destroyed: 'DESTROYED',
  Fleeing: 'FLEEING',
} as const;
export type BossState = (typeof BossState)[keyof typeof BossState];

/** What a boss reads and drives of the world: the ship's position and the enemy bullets. */
export type BossWorld = WorldView & EnemyShotSpawner;

/**
 * The part that breaks off the sprite when a phase begins (GDD §6), as data for the debris effect
 * (F-2c): its centre relative to the boss, and its size, in pixels.
 */
export interface BrokenPart {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly width: number;
  readonly height: number;
}

/** One phase of a boss (ADR-0003: phases are data): when it starts and what it does. */
export interface BossPhaseSpec {
  /** The phase starts when the HP falls to this value or below, in tenths (ADR-0019). */
  readonly hpThreshold: number;
  readonly movement: MovementPattern;
  readonly attack: AttackPattern;
  /** What breaks off when this phase begins; none for the first phase. */
  readonly brokenPart?: BrokenPart;
}

/**
 * A boss as data (ADR-0023 decision 4): the fight, not the score — the bonus is `BossTuning`.
 * Times are in seconds, speeds in px/s; `Boss.start` converts them to steps.
 */
export interface BossDefinition {
  /** `hp` in tenths; `score` is unused (boss hits score 0, GDD v0.10 §6). */
  readonly stats: EnemyStats;
  /** Two or three phases, the first starting at full HP. */
  readonly phases: readonly BossPhaseSpec[];
  /** The fight's timer; when it runs out the boss flees. */
  readonly timeLimit: number;
  /** Seconds of WARNING: waves stopped, boss off the field. */
  readonly warningS: number;
  readonly entryFrom: Readonly<Vec2>;
  readonly entryTo: Readonly<Vec2>;
  /** Seconds of the straight slide from `entryFrom` to `entryTo`. */
  readonly entryS: number;
  /** Straight up, in px/s. */
  readonly fleeSpeed: number;
  /** The explosion sequence after the last hit. */
  readonly destroyedS: number;
}

/** What `Boss.advance` reports to the run at step 7. */
export const BossAdvance = {
  None: 0,
  /** The timer ran out: the boss now flees. */
  Fled: 1,
  /** The destroyed or fleeing sequence ended: the boss is idle again. */
  Ended: 2,
} as const;
export type BossAdvance = (typeof BossAdvance)[keyof typeof BossAdvance];

const AXIS_X = FIELD_WIDTH / 2;

/**
 * The one boss of a level (class diagram, ADR-0022): a preallocated `Body` owned by `World`,
 * outside the enemy pool, idle until `start`. It owns its state, its phase, its timers (in steps)
 * and the movement and attack of the current phase; it publishes nothing — `Run` does, from what
 * `applyDamage`, `advancePhase` and `advance` report.
 *
 * A phase change has two moments (ADR-0023 decision 3): at the HP threshold the attack switches
 * at once and its timer and volleys restart; the movement keeps its path until `x − 120` changes
 * sign, then swaps, snaps to x 120, restarts `age` and sets `mirror` to its direction.
 */
export class Boss implements Body {
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
  state: BossState = BossState.Idle;
  /** The phase whose attack is firing (0-based). */
  phaseIndex = 0;
  /** Steps spent in the current state. */
  stateSteps = 0;
  /** Steps left on the fight's timer; frozen outside `FIGHTING`. */
  timeLeft = 0;
  private definition: BossDefinition | undefined;
  /** The phase whose movement is running: behind `phaseIndex` until the sway crosses x 120. */
  private movementPhase = 0;
  private warningSteps = 0;
  private entrySteps = 0;
  private destroyedSteps = 0;

  /** Resets every field from the definition, in the `WARNING` state, off the field. */
  start(definition: BossDefinition, serial: number): void {
    this.definition = definition;
    this.serial = serial;
    this.state = BossState.Warning;
    this.stateSteps = 0;
    this.phaseIndex = 0;
    this.movementPhase = 0;
    this.warningSteps = toSteps(definition.warningS);
    this.entrySteps = toSteps(definition.entryS);
    this.destroyedSteps = toSteps(definition.destroyedS);
    this.timeLeft = toSteps(definition.timeLimit);
    this.width = definition.stats.width;
    this.height = definition.stats.height;
    this.hp = definition.stats.hp;
    this.position.x = definition.entryFrom.x;
    this.position.y = definition.entryFrom.y;
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.origin.x = this.position.x;
    this.origin.y = this.position.y;
    this.hover.x = definition.entryTo.x;
    this.hover.y = definition.entryTo.y;
    this.age = 0;
    this.fireTimer = 0;
    this.volleys = 0;
    this.mirror = false;
    this.entered = false;
    this.armed = false;
    this.spent = false;
  }

  /** Shots and the bomb reach it only while it fights (GDD v0.10 §6). */
  isTargetable(): boolean {
    return this.state === BossState.Fighting;
  }

  /** Its body hurts the ship while it enters and fights, never in the end sequences. */
  isHarmful(): boolean {
    return this.state === BossState.Entering || this.state === BossState.Fighting;
  }

  /** The whole seconds the HUD shows: the steps left, rounded up (GDD v0.10 §6). */
  secondsLeft(): number {
    return Math.ceil(this.timeLeft / STEPS_PER_SECOND);
  }

  /** The HP bar, 0 to 1, clamped at 0 once the boss is dead. */
  hpRatio(): number {
    if (this.definition === undefined) return 0;
    return Math.max(0, this.hp) / this.definition.stats.hp;
  }

  /**
   * Starts the next phase when the HP has fallen to its threshold: the attack switches at once and
   * restarts, the movement waits for the sway to cross x 120. True once per phase entered, so the
   * run calls it in a loop and a hit crossing two thresholds enters two phases.
   */
  advancePhase(world: BossWorld): boolean {
    const next = this.definition?.phases[this.phaseIndex + 1];
    if (next === undefined || this.hp > next.hpThreshold) return false;
    this.phaseIndex += 1;
    this.restartAttack(world);
    return true;
  }

  /** The kill: the explosion sequence begins and the body turns harmless. */
  destroy(): void {
    this.state = BossState.Destroyed;
    this.stateSteps = 0;
    this.armed = false;
  }

  /**
   * Step 4: the body ages, moves and attacks according to its state. `previousPosition` is the
   * position before this step, so the boss interpolates like any body.
   */
  move(world: BossWorld, dt: number): void {
    const definition = this.definition;
    if (definition === undefined || this.state === BossState.Idle) return;
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;
    this.stateSteps += 1;
    switch (this.state) {
      case BossState.Entering: {
        const t = Math.min(this.stateSteps / this.entrySteps, 1);
        this.position.x =
          definition.entryFrom.x + (definition.entryTo.x - definition.entryFrom.x) * t;
        this.position.y =
          definition.entryFrom.y + (definition.entryTo.y - definition.entryFrom.y) * t;
        return;
      }
      case BossState.Fighting:
        this.fight(definition, world, dt);
        return;
      case BossState.Fleeing:
        this.position.y -= definition.fleeSpeed * dt;
        return;
      default:
        // Warning waits off the field; Destroyed stays where it fell.
        return;
    }
  }

  /**
   * Step 7: the state timers advance and a state that is over gives way to the next. Returns what
   * the run must do: nothing, publish the escape, or end the boss sequence.
   */
  advance(world: BossWorld): BossAdvance {
    const definition = this.definition;
    if (definition === undefined) return BossAdvance.None;
    switch (this.state) {
      case BossState.Warning:
        if (this.stateSteps >= this.warningSteps) this.enter(BossState.Entering);
        return BossAdvance.None;
      case BossState.Entering:
        if (this.stateSteps >= this.entrySteps) this.beginFight(world);
        return BossAdvance.None;
      case BossState.Fighting:
        this.timeLeft -= 1;
        if (this.timeLeft > 0) return BossAdvance.None;
        this.armed = false;
        this.enter(BossState.Fleeing);
        return BossAdvance.Fled;
      case BossState.Destroyed:
        if (this.stateSteps < this.destroyedSteps) return BossAdvance.None;
        this.enter(BossState.Idle);
        return BossAdvance.Ended;
      case BossState.Fleeing:
        if (overlapsField(this.position.x, this.position.y, this.width, this.height)) {
          return BossAdvance.None;
        }
        this.enter(BossState.Idle);
        return BossAdvance.Ended;
      default:
        return BossAdvance.None;
    }
  }

  private enter(state: BossState): void {
    this.state = state;
    this.stateSteps = 0;
  }

  /** The fight starts on the axis, in the first phase, with its attack timer full. */
  private beginFight(world: BossWorld): void {
    this.enter(BossState.Fighting);
    this.phaseIndex = 0;
    this.movementPhase = 0;
    this.age = 0;
    this.mirror = false;
    this.restartAttack(world);
    this.armed = true;
  }

  private fight(definition: BossDefinition, world: BossWorld, dt: number): void {
    this.age += 1;
    const before = this.position.x;
    definition.phases[this.movementPhase]?.movement.tick(this, world, dt);
    if (this.movementPhase !== this.phaseIndex && crossesAxis(before, this.position.x)) {
      // The new sway starts on the axis, in the direction the old one was moving.
      this.movementPhase = this.phaseIndex;
      this.age = 0;
      this.mirror = this.position.x < before;
      this.position.x = AXIS_X;
    }
    definition.phases[this.phaseIndex]?.attack.tick(this, world, world, dt);
  }

  /**
   * Restarts the attack of the current phase: the volleys count from 0 and a disarmed tick fills
   * the timer, so the first volley comes one period after the next step, as for any attack.
   */
  private restartAttack(world: BossWorld): void {
    const attack = this.definition?.phases[this.phaseIndex]?.attack;
    this.volleys = 0;
    if (attack === undefined) return;
    const wasArmed = this.armed;
    this.armed = false;
    attack.tick(this, world, world, 0);
    this.armed = wasArmed;
  }
}

/** Whether a step from `before` to `after` goes through or onto the axis, x 120. */
function crossesAxis(before: number, after: number): boolean {
  return (before < AXIS_X && after >= AXIS_X) || (before > AXIS_X && after <= AXIS_X);
}
