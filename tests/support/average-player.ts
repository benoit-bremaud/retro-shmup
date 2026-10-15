import { GameEventKind } from '../../src/domain/game/events';
import { Run, RunOutcome } from '../../src/domain/game/run';
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
  /** Seconds since the start when power 3, 4 and 5 were first reached; NaN when never. */
  readonly powerAtS: readonly number[];
  readonly bombsUsed: number;
}

const DT = 1 / 60;
/** The waves last 120 s, the boss at most 3 + 3 + 90 s, then the destroyed sequence. */
const MAX_STEPS = 60 * 230;
/** How far ahead (seconds) a bullet's path is checked against the ship. */
const LOOKAHEAD_S = 0.8;
const DANGER_PX = 10;

/** Plays one run of level 1 with `profile` on `seed` and measures it. */
export function measureRun(profile: PlayerProfile, seed: number): RunMeasure {
  const run = new Run({ seed });
  const mind = new SeededRandom(seed * 7919 + 1);
  const frame = createIntentFrame();
  const holdSteps = Math.max(1, Math.round(profile.reactionS * 60));
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
  const powerAt = [NaN, NaN, NaN];
  for (; step < MAX_STEPS && run.outcome() === RunOutcome.Playing; step += 1) {
    if (step % holdSteps === 0) decide(run, profile, mind, frame);
    else frame.pressed = 0;
    run.step(DT, frame);
    const power = run.snapshot().power;
    for (let p = 3; p <= power; p += 1)
      if (Number.isNaN(powerAt[p - 3])) powerAt[p - 3] = step / 60;
  }
  return {
    deaths,
    gameOver: run.outcome() === RunOutcome.GameOver,
    bossKilled: killStep >= 0,
    bossFightS: killStep >= 0 ? (killStep - warningStep) / 60 : NaN,
    score: run.snapshot().score,
    powerAtS: powerAt,
    bombsUsed: bombs,
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
    if (Math.abs(e.x - me.x) < 20 && e.y > me.y - 60 && e.y < me.y + 10) {
      threats += 1;
    }
  }
  frame.moveKind = 'direction';
  frame.held = Button.Fire;
  frame.pressed = 0;
  frame.moveY = me.y < 250 ? 0.5 : me.y > 290 ? -0.5 : 0;
  const sees = threats > 0 && mind.next() >= profile.missChance;
  if (sees && threats >= 3 && view.bombs > 0 && mind.next() < profile.bombChance) {
    frame.pressed = Button.Bomb;
  }
  if (sees) {
    safestMove(run, frame);
    return;
  }
  frame.moveX = steerTo(me.x, targetX(run, me.y));
}

/** The 3 × 3 move directions a look may pick to dodge. */
const MOVES = [-1, 0, 1] as const;
const SPEED = 150;

/**
 * Picks the direction that keeps the ship farthest from every bullet over the look-ahead, the
 * way a player reads the whole pattern rather than the nearest bullet; ties keep the ship low.
 */
function safestMove(run: Run, frame: IntentFrame): void {
  const view = run.snapshot();
  const me = view.player.position;
  let best = -Infinity;
  for (const mx of MOVES) {
    for (const my of MOVES) {
      let worst = Infinity;
      for (let s = 1; s <= 8; s += 1) {
        const t = (s / 8) * LOOKAHEAD_S;
        const x = Math.max(16, Math.min(224, me.x + mx * SPEED * t));
        const y = Math.max(140, Math.min(304, me.y + my * SPEED * t));
        for (let k = 0; k < view.enemyBullets.count; k += 1) {
          const b = view.enemyBullets.at(k);
          const dx = x - (b.position.x + b.velocity.x * t);
          const dy = y - (b.position.y + b.velocity.y * t);
          worst = Math.min(worst, dx * dx + dy * dy);
        }
      }
      const score = Math.min(worst, 900) + (my >= 0 ? 1 : 0);
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
function targetX(run: Run, myY: number): number {
  const view = run.snapshot();
  for (let k = 0; k < view.pickups.count; k += 1) {
    const p = view.pickups.at(k).position;
    if (p.y > 120 && p.y < myY) return p.x;
  }
  if (view.boss.hpRatio > 0 && view.boss.position.y > 0) return view.boss.position.x;
  let best = 120;
  let bestY = -Infinity;
  for (let k = 0; k < view.enemies.count; k += 1) {
    const e = view.enemies.at(k).position;
    if (e.y > bestY && e.y < myY - 40) {
      bestY = e.y;
      best = e.x;
    }
  }
  return best;
}

function steerTo(from: number, to: number): number {
  const gap = to - from;
  if (Math.abs(gap) < 3) return 0;
  return Math.max(-1, Math.min(1, gap / 20));
}
