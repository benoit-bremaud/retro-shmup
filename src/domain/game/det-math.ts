/**
 * Trigonometry that every JavaScript engine computes to the same bits (ADR-0031 decision 10).
 * `Math.sin`, `Math.cos` and `Math.hypot` are implementation-approximated, so a run replayed in
 * another engine could drift; these use only the operations ECMAScript defines exactly
 * (`+ - * / %`, `Math.floor`, `Math.sqrt`). The error bound holds for |x| < 1e9 rad; the game's
 * arguments stay below 1e5.
 */

/** Table steps per quarter turn. */
const QUARTER = 4096;
/** Table steps per full turn. */
const TURN = QUARTER * 4;
/** Converts radians to table steps. */
const STEPS_PER_RADIAN = (QUARTER * 2) / Math.PI;

/** Sine on [0, π/2] by its Taylor series to x^17, Horner form: error below 1e-13 there. */
function taylorSin(x: number): number {
  const x2 = x * x;
  let sum = 0;
  for (let n = 17; n >= 3; n -= 2) {
    sum = (x2 / (n * (n - 1))) * (1 - sum);
  }
  return x * (1 - sum);
}

/** sin of r / QUARTER of a quarter turn, for r in [0, QUARTER], built once at load. */
const QUARTER_WAVE = buildQuarterWave();

function buildQuarterWave(): Float64Array {
  const table = new Float64Array(QUARTER + 1);
  for (let r = 0; r <= QUARTER; r++) {
    table[r] = taylorSin((r * Math.PI) / (QUARTER * 2));
  }
  table[QUARTER] = 1;
  return table;
}

/** Sine at table step j of a full turn, j in [0, TURN). */
function sample(j: number): number {
  const r = j % QUARTER;
  const quadrant = (j - r) / QUARTER;
  const value = QUARTER_WAVE[quadrant === 0 || quadrant === 2 ? r : QUARTER - r] ?? 0;
  return quadrant < 2 ? value : -value;
}

/** Sine of a non-negative angle, interpolated linearly between table steps. */
function sineOfSteps(steps: number): number {
  const whole = Math.floor(steps);
  const fraction = steps - whole;
  const j = whole % TURN;
  const low = sample(j);
  if (fraction === 0) return low;
  return low + fraction * (sample((j + 1) % TURN) - low);
}

/**
 * Deterministic sine, error below 1e-6. Odd by construction: `detSin(-x) === -detSin(x)` (under
 * `===`: `detSin(-0)` is `+0`, the same in every engine).
 */
export function detSin(radians: number): number {
  if (radians < 0) return -sineOfSteps(-radians * STEPS_PER_RADIAN);
  return sineOfSteps(radians * STEPS_PER_RADIAN);
}

/** Deterministic cosine, error below 1e-6. Even by construction: `detCos(-x) === detCos(x)`. */
export function detCos(radians: number): number {
  const steps = (radians < 0 ? -radians : radians) * STEPS_PER_RADIAN;
  return sineOfSteps(steps + QUARTER);
}

/** Deterministic length of (x, y): `Math.sqrt` is correctly rounded everywhere. */
export function detHypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
