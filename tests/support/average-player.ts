import { GameEventKind } from '../../src/domain/game/events';
import { FIELD_WIDTH } from '../../src/domain/game/geometry';
import { Run, RunOutcome } from '../../src/domain/game/run';
import {
  KitCaps,
  PlayerTuning,
  STEP_SECONDS,
  STEPS_PER_SECOND,
} from '../../src/domain/game/tuning';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { SeededRandom } from '../../src/domain/random/seeded-random';

/**
 * A model of a human player for the balance measurements (#56): it sees the field only every
 * `reactionS` seconds and holds its decision in between, misjudges a threat with probability
 * `missChance`, and bombs only when cornered. Deterministic: its own seeded random.
 */
export interface PlayerProfile {
  readonly name: string;
  /** Seconds between two looks at the field (sample and hold). */
  readonly reactionS: number;
  /** Chance that a look ignores the nearest threat. */
  readonly missChance: number;
  /** Chance that a cornered look uses a bomb, when one is held. */
  readonly bombChance: number;
}

export const GOOD: PlayerProfile = {
  name: 'good',
  reactionS: 0.15,
  missChance: 0.05,
  bombChance: 0.8,
};
export const AVERAGE: PlayerProfile = {
  name: 'average',
  reactionS: 0.25,
  missChance: 0.15,
  bombChance: 0.5,
};
export const BEGINNER: PlayerProfile = {
  name: 'beginner',
  reactionS: 0.4,
  missChance: 0.3,
  bombChance: 0.3,
};

/** What one run measured. */
export interface RunMeasure {
  readonly deaths: number;
  readonly gameOver: boolean;
  readonly bossKilled: boolean;
  /** Seconds from the WARNING to `BOSS_DESTROYED`; NaN when not killed. */
  readonly bossFightS: number;
  readonly score: number;
  /** Seconds since the start when power 5 was first reached; NaN when never. */
  readonly fullPowerS: number;
  readonly bombsUsed: number;
  /** Seconds with no enemy on the field before `EMPTY_UNTIL_S` (GDD v0.21 §7.2.3). */
  readonly emptyS: number;
}

/** The waves last 120 s, the boss at most 3 + 3 + 90 s, then the destroyed sequence. */
const MAX_STEPS = STEPS_PER_SECOND * 230;
/** The empty-field count stops here: the calm before the WARNING is empty on purpose (§7.2.2). */
const EMPTY_UNTIL_S = 116;
/** How far ahead (seconds) a bullet's path is checked against the ship. */
const LOOKAHEAD_S = 0.8;
/** Samples of that look-ahead per candidate move. */
const LOOKAHEAD_SAMPLES = 8;
/** A bullet passing nearer than this to the ship is a threat. */
const DANGER_PX = 10;
/** An enemy this close across, from this far above to this far below, is a threat too. */
const BODY_ACROSS_PX = 20;
const BODY_ABOVE_PX = 60;
const BODY_BELOW_PX = 10;
/** A look with this many threats feels cornered and may bomb. */
const CORNERED_THREATS = 3;
/** The ship keeps between these heights when nothing threatens it. */
const LOW_BAND = { top: 250, bottom: 290 } as const;
/** The heights a dodge may reach. */
const DODGE_BAND = { top: 140, bottom: 304 } as const;
/** Beyond this squared distance every move is as safe: the tie-break decides. */
const SAFE_DISTANCE_SQ = 30 * 30;
/** Pickups below this height are worth chasing. */
const PICKUP_LINE_Y = 120;
/** A target enemy must be at least this far above the ship. */
const TARGET_ABOVE_PX = 40;
/** Steering: dead zone and the gap that gives full speed. */
const STEER_DEAD_PX = 3;
const STEER_FULL_PX = 20;

/** Plays one run of level 1 with `profile` on `seed` and measures it. */
export function measureRun(profile: PlayerProfile, seed: number): RunMeasure {
  const run = new Run({ seed });
  const mind = new SeededRandom(seed * 7919 + 1);
  const frame = createIntentFrame();
  const holdSteps = Math.max(1, Math.round(profile.reactionS * STEPS_PER_SECOND));
  let deaths = 0;
  let bombs = 0;
  let warningStep = -1;
  let killStep = -1;
  let step = 0;
  const events = run.events();
  events.subscribe(GameEventKind.PlayerDied, () => (deaths += 1));
  events.subscribe(GameEventKind.BombUsed, () => (bombs += 1));
  events.subscribe(GameEventKind.BossWarning, () => (warningStep = step));
  events.subscribe(GameEventKind.BossDestroyed, () => (killStep = step));
  let fullPowerS = NaN;
  let emptySteps = 0;
  for (; step < MAX_STEPS && run.outcome() === RunOutcome.Playing; step += 1) {
    if (step % holdSteps === 0) decide(run, profile, mind, frame);
    else frame.pressed = 0;
    run.step(STEP_SECONDS, frame);
    if (step < EMPTY_UNTIL_S * STEPS_PER_SECOND && run.snapshot().enemies.count === 0) {
      emptySteps += 1;
    }
    if (Number.isNaN(fullPowerS) && run.snapshot().power === KitCaps.maxPower) {
      fullPowerS = step / STEPS_PER_SECOND;
    }
  }
  return {
    deaths,
    gameOver: run.outcome() === RunOutcome.GameOver,
    bossKilled: killStep >= 0,
    bossFightS: killStep >= 0 ? (killStep - warningStep) / STEPS_PER_SECOND : NaN,
    score: run.snapshot().score,
    fullPowerS,
    bombsUsed: bombs,
    emptyS: emptySteps / STEPS_PER_SECOND,
  };
}

/** One look at the field: dodge the most urgent bullet, else go for a pickup or the nearest target. */
function decide(run: Run, profile: PlayerProfile, mind: SeededRandom, frame: IntentFrame): void {
  const view = run.snapshot();
  const me = view.player.position;
  let threats = 0;
  for (let k = 0; k < view.enemyBullets.count; k += 1) {
    const b = view.enemyBullets.at(k);
    const t = closestApproachT(
      me.x - b.position.x,
      me.y - b.position.y,
      b.velocity.x,
      b.velocity.y,
    );
    if (t > LOOKAHEAD_S) continue;
    const dx = me.x - (b.position.x + b.velocity.x * t);
    const dy = me.y - (b.position.y + b.velocity.y * t);
    if (dx * dx + dy * dy > DANGER_PX * DANGER_PX) continue;
    threats += 1;
  }
  for (let k = 0; k < view.enemies.count; k += 1) {
    const e = view.enemies.at(k).position;
    if (
      Math.abs(e.x - me.x) < BODY_ACROSS_PX &&
      e.y > me.y - BODY_ABOVE_PX &&
      e.y < me.y + BODY_BELOW_PX
    ) {
      threats += 1;
    }
  }
  frame.moveKind = 'direction';
  frame.held = Button.Fire;
  frame.pressed = 0;
  frame.moveY = me.y < LOW_BAND.top ? 0.5 : me.y > LOW_BAND.bottom ? -0.5 : 0;
  const sees = threats > 0 && mind.next() >= profile.missChance;
  if (sees && threats >= CORNERED_THREATS && view.bombs > 0 && mind.next() < profile.bombChance) {
    frame.pressed = Button.Bomb;
  }
  if (sees) {
    safestMove(view, frame);
    return;
  }
  frame.moveX = steerTo(me.x, targetX(view, me.y));
}

type View = ReturnType<Run['snapshot']>;

const SPEED = PlayerTuning.maxSpeed;
/** The 3 × 3 move directions a look may pick to dodge. */
const MOVES = [-1, 0, 1] as const;

/**
 * Picks the direction that keeps the ship farthest from every bullet over the look-ahead, the
 * way a player reads the whole pattern rather than the nearest bullet; ties keep the ship low.
 */
function safestMove(view: View, frame: IntentFrame): void {
  const me = view.player.position;
  let best = -Infinity;
  for (const mx of MOVES) {
    for (const my of MOVES) {
      let worst = Infinity;
      for (let s = 1; s <= LOOKAHEAD_SAMPLES; s += 1) {
        const t = (s / LOOKAHEAD_SAMPLES) * LOOKAHEAD_S;
        const x = clamp(
          me.x + mx * SPEED * t,
          PlayerTuning.halfSize,
          FIELD_WIDTH - PlayerTuning.halfSize,
        );
        const y = clamp(me.y + my * SPEED * t, DODGE_BAND.top, DODGE_BAND.bottom);
        for (let k = 0; k < view.enemyBullets.count; k += 1) {
          const b = view.enemyBullets.at(k);
          const dx = x - (b.position.x + b.velocity.x * t);
          const dy = y - (b.position.y + b.velocity.y * t);
          worst = Math.min(worst, dx * dx + dy * dy);
        }
      }
      const score = Math.min(worst, SAFE_DISTANCE_SQ) + (my >= 0 ? 1 : 0);
      if (score > best) {
        best = score;
        frame.moveX = mx;
        frame.moveY = my;
      }
    }
  }
}

/** The time of closest approach of a bullet moving at (vx, vy) from offset (dx, dy) to the ship. */
function closestApproachT(dx: number, dy: number, vx: number, vy: number): number {
  const v2 = vx * vx + vy * vy;
  if (v2 === 0) return 0;
  const t = (dx * vx + dy * vy) / v2;
  return t < 0 ? Infinity : t;
}

/** A falling pickup first, then the boss, then the lowest enemy. */
function targetX(view: View, myY: number): number {
  for (let k = 0; k < view.pickups.count; k += 1) {
    const p = view.pickups.at(k).position;
    if (p.y > PICKUP_LINE_Y && p.y < myY) return p.x;
  }
  if (view.boss.hpRatio > 0 && view.boss.position.y > 0) return view.boss.position.x;
  let best = FIELD_WIDTH / 2;
  let bestY = -Infinity;
  for (let k = 0; k < view.enemies.count; k += 1) {
    const e = view.enemies.at(k).position;
    if (e.y > bestY && e.y < myY - TARGET_ABOVE_PX) {
      bestY = e.y;
      best = e.x;
    }
  }
  return best;
}

function steerTo(from: number, to: number): number {
  const gap = to - from;
  if (Math.abs(gap) < STEER_DEAD_PX) return 0;
  return clamp(gap / STEER_FULL_PX, -1, 1);
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
