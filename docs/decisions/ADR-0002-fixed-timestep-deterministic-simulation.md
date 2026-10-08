# ADR-0002: Fixed 60 Hz timestep, deterministic simulation, performance budget

**Status:** Accepted — 2026-10-07

## Context

The GDD makes three demands on the simulation that a naive browser game loop cannot meet.

- **Replayability of level scripts** (GDD §7.1): a level is a declarative, timed script, and the
  same script with the same inputs and the same RNG seed must always produce the same run. This is
  the foundation of the headless simulation tests (GDD §13, ADR-0003), of comparable scores on the
  local top 10 (GDD §8), and of replays planned for v2 (GDD §11.3).
- **Heterogeneous displays and hostile scheduling**: `requestAnimationFrame` fires at the display
  refresh rate (60, 75, 120 or 144 Hz are all common) and is paused in background tabs; timers are
  throttled when the tab is hidden. A simulation whose step is tied to the callback cadence runs at
  a different speed on every machine and jumps forward when the tab regains focus.
- **Performance target** (GDD §13): 60 fps on a 2019 mid-range phone and on any laptop, with no
  more than 4 ms of logic per frame and no allocation inside the game loop. A 60 fps frame lasts
  1000 / 60 = 16.67 ms; keeping logic at 4 ms (24 % of the frame) leaves about 12 ms for rendering
  (ADR-0001) and for the browser's own compositing. JavaScript is garbage-collected, and a
  collection pause of a few milliseconds in the middle of a frame is a visible hitch.

The owner's explicit requirements, fixed in CLAUDE.md, are: fixed timestep, deterministic
simulation, seeded RNG, no `Date.now()` / `Math.random()` inside the simulation, no allocation
inside the game loop, and a domain that never imports the browser.

## Decision

1. **Fixed timestep of 1/60 s with an accumulator** (Fiedler, "Fix Your Timestep!"). The loop
   measures the elapsed wall time between two frames, adds it to an accumulator, and runs the
   simulation step `dt = 1 / 60` as many whole times as the accumulator allows. Elapsed time is
   read from the monotonic `performance.now()` clock in the adapter only; the simulation never sees
   wall time, only `dt` and a tick counter. 60 Hz is chosen because it is the dominant refresh rate
   (one step per frame on a 60 Hz display, two renders per step at 120 Hz) and because the GDD
   already expresses effects in frames (2-frame hit flash, 2–3 frame hit-stop, GDD §9.4).
2. **Render interpolation**: rendering happens once per `requestAnimationFrame` callback, drawing
   each entity at `previous + (current - previous) * alpha` with `alpha = accumulator / dt`. This
   keeps motion smooth at 120 or 144 Hz and hides the occasional 0-step or 2-step frame on a 60 Hz
   display. Hitboxes and all gameplay decisions use the current simulated position only.
3. **Frame delta clamp at 0.25 s**: a single frame may never advance the simulation by more than
   0.25 s (15 steps). The value is Fiedler's; it caps catch-up work after a GC pause, a throttled
   tab or a debugger break, and prevents the spiral of death (steps that take longer than real time
   queue more steps). When a tab returns from the background, up to 0.25 s of game time elapses,
   the rest is dropped; pausing on `visibilitychange` is a UI-layer concern outside this ADR.
4. **Clock abstraction**: the domain depends on a `Clock` port; `Date.now()`, `performance.now()`
   and `requestAnimationFrame` appear only in the browser adapter.
5. **Seeded deterministic PRNG injected into the simulation**: all gameplay randomness (drop rolls
   at 30 % / 60 %, GDD §5.2; pickup sway; starfield) draws from one `Random` instance created from
   a seed at level start. The algorithm must be a small, seedable generator with 32-bit integer
   state (for example xoshiro128**, Blackman and Vigna); the exact choice is fixed in code review,
   not here. `Math.random()` is forbidden in `src/domain` (layout: ADR-0003).
6. **Object pools** for bullets (10–40 enemy bullets on screen, GDD §5.2, plus player bullets),
   particles and pickups: every pool is filled at level load and the loop only acquires and
   releases. Pool sizes derive from the GDD ceilings plus headroom and are tuned on the vertical
   slice; a pool that is exhausted drops the request (bullets, particles) or logs in development
   builds (pickups), never allocates.
7. **Logic budget of 4 ms per step** on the reference device, measured in the browser smoke test
   and in a development overlay; exceeding it is a performance bug, not a reason to lower the Hz.
8. **The simulation is pure TypeScript**: no `window`, `document`, `canvas`, `AudioContext`,
   `localStorage` or timers inside `src/domain`; it runs unchanged under Vitest in Node.

Minimal interfaces (signatures only; names are the contract for ADR-0003):

```ts
export interface Clock { now(): number }                     // milliseconds, monotonic
export interface Random { next(): number; seed(s: number): void }   // next() in [0, 1)
export interface Pool<T> { acquire(): T | undefined; release(item: T): void; readonly size: number }
export interface Simulation { step(dt: number, intents: ReadonlySet<Intent>): void }
export function runFixedStep(clock: Clock, sim: Simulation, dt: number, maxDelta: number): void
```

## Alternatives considered

- **Variable timestep** (`dt` = measured frame time) — rejected because the simulation is
  non-deterministic (depends on the machine's frame times), physics drifts with `dt`, and replays
  and headless tests become impossible.
- **Semi-fixed timestep** (variable `dt` capped at a maximum) — rejected because it only bounds
  the error; the step count per second still depends on the machine, so two runs still diverge.
- **requestAnimationFrame-driven logic only** (one simulation step per callback) — rejected because
  the game would run 2× faster on a 120 Hz display and 2.4× faster at 144 Hz, and would freeze
  entirely in a background tab.
- **Fixed timestep without interpolation** — rejected because motion judders on displays whose
  refresh rate is not a multiple of 60 Hz; the extra render cost (one previous-state copy per
  entity) is small.

## Consequences

Positive:

- Tests drive the simulation tick by tick (`sim.step(1 / 60, intents)`) with a seeded `Random` and
  scripted intents; a whole level replays headlessly in milliseconds, and a level regression is a
  failing assertion on score or state at tick N (ADR-0003).
- Replays (v2) reduce to a seed plus a per-tick intent log; no new engine work is needed.
- The 4 ms budget and the pools are measurable, so performance regressions are caught by numbers.

Negative:

- Interpolation adds render complexity: every drawable keeps a previous position, and newly
  spawned or teleported entities must reset both positions to avoid a one-frame smear.
- Pools require discipline; a single `new Bullet()` in a hot path reintroduces GC hitches
  silently. Code review enforces the CLAUDE.md rule "no allocation inside the game loop".
- Input is sampled per step, so inputs that arrive between steps are applied at the next step
  (at most 16.67 ms of latency), which is acceptable for a Raiden-density shmup.

Follow-ups and review rules:

- Review checklist: no `Date.now()`, `performance.now()`, `Math.random()`, `setTimeout`,
  `requestAnimationFrame` or DOM API under `src/domain`; every spawn goes through a pool; no closure
  or array literal created inside `step()`. An ESLint `no-restricted-globals` rule scoped to
  `src/domain` turns the first three into build errors once tooling arrives (PROJECT_LOG,
  "keep it simple first").
- Tests implied: unit tests for the accumulator (0, 1, 2 steps per frame; clamp at 0.25 s), for
  the `Random` sequence given a seed, and for pool acquire/release/exhaustion; one headless
  determinism test that runs level 1 twice with the same seed and asserts identical final state.
- Risk to verify on CI: ECMA-262 specifies `Math.sin`, `Math.cos` and similar as
  implementation-approximated, so cross-engine replay identity is not guaranteed by the language.
  The headless determinism test runs in Node and the smoke test in a browser; if they ever
  diverge, movement curves switch to precomputed tables. This rationale is internal.

## References

- Glenn Fiedler, "Fix Your Timestep!", Gaffer On Games —
  <https://gafferongames.com/post/fix_your_timestep/> (accumulator, 0.25 s clamp, interpolation).
- Robert Nystrom, *Game Programming Patterns*, "Game Loop" and "Object Pool" —
  <https://gameprogrammingpatterns.com/game-loop.html>,
  <https://gameprogrammingpatterns.com/object-pool.html>.
- MDN, "Window: requestAnimationFrame() method" (refresh-rate cadence, paused in background tabs)
  and "Page Visibility API" (timer throttling in hidden tabs).
- MDN, "Performance: now() method" (monotonic high-resolution clock).
- David Blackman and Sebastiano Vigna, "A PRNG Shootout" — <https://prng.di.unimi.it/>.
- ECMA-262, "Function Properties of the Math Object" (implementation-approximated functions).
- Michael Nygard, "Documenting Architecture Decisions" (ADR format).
- GDD §5.2 (bullet and drop numbers), §7.1 (deterministic scripts), §9.4 (frame-based effects),
  §13 (technical constraints); CLAUDE.md "Non-negotiables"; ADR-0001 (rendering), ADR-0003
  (architecture and tests).
