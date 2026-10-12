import type { BossDefinition } from './boss';
import type { Formation } from './formation';
import { FIELD_WIDTH, overlapsField } from './geometry';
import type { LevelScript, ScriptEvent } from './level-script';
import { toSteps } from './tuning';

/** Where the director puts the enemies it spawns (implemented by `World`). */
export interface EnemySpawner {
  /** A new formation of `total` members, or `undefined` when the formation pool is full. */
  startFormation(total: number): Formation | undefined;
  /** False when a full enemy pool refused the spawn. */
  spawnEnemy(event: Readonly<ScriptEvent>, formation: Formation | undefined): boolean;
  /** At `warningAt`, once: the boss starts in `WARNING` (02-sequence-boss-fight). */
  startBoss(definition: BossDefinition): void;
}

/** A single spawn of the expanded script: the step it is due, its source row and its rank. */
interface Spawn {
  readonly step: number;
  readonly event: Readonly<ScriptEvent>;
  readonly row: number;
  readonly rank: number;
}

function formsFormation(event: Readonly<ScriptEvent>): boolean {
  return event.archetype.formation && event.count > 1;
}

/** No spawn at or after this long before the warning (GDD v0.10 §6): the field drains first. */
const DRAIN_SECONDS = 4;
const MIN_FORMATION = 5;
const MAX_FORMATION = 8;

/**
 * Checks a script row at load (class diagram rule table): fails closed with a `RangeError`, so a
 * broken script fails its first test, never a run.
 */
function checkEvent(event: Readonly<ScriptEvent>, lastSpawnLimit: number): void {
  const label = `${event.archetype.id} at ${String(event.at)} s`;
  if (!Number.isFinite(event.at) || event.at < 0) {
    throw new RangeError(`Level script: ${label} needs a time of 0 s or more`);
  }
  if (!Number.isInteger(event.count) || event.count < 1) {
    throw new RangeError(`Level script: ${label} needs a positive whole count`);
  }
  if (event.count === 1 && event.interval !== undefined) {
    throw new RangeError(`Level script: ${label} is one enemy, it takes no interval`);
  }
  const interval = event.interval;
  const intervalMissing =
    interval === undefined || !Number.isFinite(interval) || toSteps(interval) <= 0;
  if (event.count > 1 && intervalMissing) {
    throw new RangeError(`Level script: ${label} is a group, it needs an interval`);
  }
  if (event.archetype.formation && event.count > 1) {
    if (event.count < MIN_FORMATION || event.count > MAX_FORMATION) {
      throw new RangeError(
        `Level script: ${label} forms a formation of 5 to 8, not ${String(event.count)}`,
      );
    }
  }
  checkCargo(event, label);
  const last = toSteps(event.at) + (event.count - 1) * toSteps(event.interval ?? 0);
  if (last >= lastSpawnLimit) {
    throw new RangeError(`Level script: ${label} spawns at or after warningAt − 4 s`);
  }
}

/**
 * A Carrier row needs a cargo, no other row may carry one, and a Carrier spawns fully outside the
 * field, at a height where its crossing passes through it, so the whole crossing is seen (GDD
 * v0.8 §5.2.1).
 */
function checkCargo(event: Readonly<ScriptEvent>, label: string): void {
  const carrier = event.archetype.carriesCargo;
  if (carrier && event.cargo === undefined) {
    throw new RangeError(`Level script: ${label} is a Carrier, it needs a cargo`);
  }
  if (!carrier && event.cargo !== undefined) {
    throw new RangeError(`Level script: ${label} cannot carry a cargo`);
  }
  if (!carrier) return;
  const { width, height } = event.archetype.stats;
  const { x, y } = event.spawn;
  if (overlapsField(x, y, width, height)) {
    throw new RangeError(`Level script: ${label} must spawn outside the field`);
  }
  // Its crossing is horizontal at a constant y: a row off the field's height never enters it, and
  // an enemy that never entered is never released.
  if (!overlapsField(FIELD_WIDTH / 2, y, width, height)) {
    throw new RangeError(`Level script: ${label} must cross the field`);
  }
}

/**
 * Walks a level script by script time (class diagram, `LevelDirector`): the script is expanded at
 * load into single spawns sorted by step, so `tick` only advances a cursor and allocates nothing.
 * At `warningAt` it stops spawning and starts the boss, once.
 */
export class LevelDirector {
  private readonly spawns: readonly Spawn[];
  private readonly warningSteps: number;
  private readonly boss: BossDefinition;
  private bossStarted = false;
  private scriptStep = 0;
  private cursor = 0;
  /** The formation of each row's current pass: a new one at each pass's first member. */
  private readonly formations: (Formation | undefined)[];

  constructor(script: LevelScript) {
    if (!Number.isFinite(script.warningAt) || script.warningAt <= DRAIN_SECONDS) {
      throw new RangeError('Level script: warningAt must be later than 4 s');
    }
    this.warningSteps = toSteps(script.warningAt);
    this.boss = script.boss;
    const lastSpawnLimit = this.warningSteps - toSteps(DRAIN_SECONDS);
    const spawns: Spawn[] = [];
    for (let i = 0; i < script.events.length; i += 1) {
      const event = script.events[i];
      if (event === undefined) continue;
      checkEvent(event, lastSpawnLimit);
      const first = toSteps(event.at);
      const every = toSteps(event.interval ?? 0);
      for (let rank = 0; rank < event.count; rank += 1) {
        spawns.push({ step: first + rank * every, event, row: i, rank });
      }
    }
    this.formations = new Array<Formation | undefined>(script.events.length).fill(undefined);
    // A stable sort keeps the script order among spawns due on the same step.
    spawns.sort((a, b) => a.step - b.step);
    this.spawns = spawns;
  }

  /**
   * Step 1 of `Run.step`: spawns every member due at this script step, and starts the boss on the
   * step that reaches `warningAt`, after which nothing spawns. The first member of a Popcorn group
   * starts the formation of its group; with the formation pool full, the whole group is dropped
   * (class diagram).
   */
  tick(spawner: EnemySpawner): void {
    if (this.bossStarted) return;
    if (this.scriptStep === this.warningSteps) {
      this.bossStarted = true;
      spawner.startBoss(this.boss);
      return;
    }
    let next = this.spawns[this.cursor];
    while (next !== undefined && next.step <= this.scriptStep) {
      if (formsFormation(next.event)) {
        if (next.rank === 0) this.formations[next.row] = spawner.startFormation(next.event.count);
        const formation = this.formations[next.row];
        if (formation !== undefined) spawner.spawnEnemy(next.event, formation);
      } else {
        spawner.spawnEnemy(next.event, undefined);
      }
      this.cursor += 1;
      next = this.spawns[this.cursor];
    }
    this.scriptStep += 1;
  }
}
