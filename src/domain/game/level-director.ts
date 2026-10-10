import type { LevelScript, ScriptEvent } from './level-script';
import { toSteps } from './tuning';

/** Where the director puts the enemies it spawns (implemented by `World`). */
export interface EnemySpawner {
  spawnEnemy(event: Readonly<ScriptEvent>): void;
}

/** A single spawn of the expanded script: the step it is due and its source event. */
interface Spawn {
  readonly step: number;
  readonly event: Readonly<ScriptEvent>;
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
  if (event.count > 1 && (event.interval === undefined || !(toSteps(event.interval) > 0))) {
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
        spawns.push({ step: first + rank * every, event });
      }
    }
    // A stable sort keeps the script order among spawns due on the same step.
    this.spawns = spawns.sort((a, b) => a.step - b.step);
  }

  /** Step 1 of `Run.step`: spawns every member due at this script step. */
  tick(spawner: EnemySpawner): void {
    let next = this.spawns[this.cursor];
    while (next !== undefined && next.step <= this.scriptStep) {
      spawner.spawnEnemy(next.event);
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
