import type { Formation } from './formation';
import type { LevelScript, ScriptEvent } from './level-script';
import { toSteps } from './tuning';

/** Where the director puts the enemies it spawns (implemented by `World`). */
export interface EnemySpawner {
  /** A new formation of `total` members, or `undefined` when the formation pool is full. */
  startFormation(total: number): Formation | undefined;
  /** False when a full enemy pool refused the spawn. */
  spawnEnemy(event: Readonly<ScriptEvent>, formation: Formation | undefined): boolean;
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

const MIN_FORMATION = 5;
const MAX_FORMATION = 8;

/**
 * Checks a script row at load (class diagram rule table): fails closed with a `RangeError`, so a
 * broken script fails its first test, never a run.
 */
function checkEvent(event: Readonly<ScriptEvent>, loopSteps: number): void {
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
  const last = toSteps(event.at) + (event.count - 1) * toSteps(event.interval ?? 0);
  if (last >= loopSteps) {
    throw new RangeError(`Level script: ${label} spawns past the loop point`);
  }
}

/**
 * Walks a level script by script time (class diagram, `LevelDirector`): the script is expanded at
 * load into single spawns sorted by step, so `tick` only advances a cursor and allocates nothing.
 * Interim (enemies brick): the script time wraps to 0 at `loopAt`.
 */
export class LevelDirector {
  private readonly spawns: readonly Spawn[];
  private readonly loopSteps: number;
  private scriptStep = 0;
  private cursor = 0;
  /** The formation of each row's current pass: a new one at each pass's first member. */
  private readonly formations: (Formation | undefined)[];

  constructor(script: LevelScript) {
    this.loopSteps =
      script.loopAt === undefined ? Number.POSITIVE_INFINITY : toSteps(script.loopAt);
    const spawns: Spawn[] = [];
    for (let i = 0; i < script.events.length; i += 1) {
      const event = script.events[i];
      if (event === undefined) continue;
      checkEvent(event, this.loopSteps);
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
   * Step 1 of `Run.step`: spawns every member due at this script step. The first member of a
   * Popcorn group starts the formation of this pass, so each loop pass is a new formation; with
   * the formation pool full, the whole pass of that group is dropped (class diagram).
   */
  tick(spawner: EnemySpawner): void {
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
    if (this.scriptStep >= this.loopSteps) {
      this.scriptStep = 0;
      this.cursor = 0;
    }
  }
}
