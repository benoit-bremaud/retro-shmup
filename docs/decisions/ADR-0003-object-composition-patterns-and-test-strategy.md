# ADR-0003: Object composition with justified patterns (no ECS, no inheritance tree), ports, and the test strategy

**Status:** Accepted — 2026-10-07

## Context

- **Entity count is small.** The simulation holds about 200 live entities at most. Derivation from the GDD: at most 40 enemy bullets on screen (§5.2, §6), one wave of up to 8 Popcorn plus a few medium or large enemies (§7.2), up to 5 player bullet streams (§4.3), a handful of pickups (§4.6), and the remainder is particle headroom served by pools (ADR-0002). This is an order-of-magnitude budget with an internal rationale, not a measured figure; it rules out the scale at which data-oriented designs pay off.
- **Behaviours cross.** Five enemy roles on three size tiers (§5.2): a Gunner hovers and fires aimed volleys, a Heavy holds position and fires rings or fans, a Carrier crosses and never fires, a Popcorn follows a curve, a Diver dives. Movement, attack and drop vary independently of size. §5.3 fixes the model: an archetype is `EnemyStats + MovementPattern + AttackPattern + DropTable`, a configuration line, and a sixth role in 1.x must be a new line, not new code.
- **Several state machines** are specified: the scene machine (§9.1: Boot, Title, Options, High scores, Credits, Playing, Paused, Level results, Ending, Game over, Name entry) and boss phases by HP threshold with a 90 s timer (§6).
- **Four input devices** (§4.2: keyboard, touch, gamepad, mouse) must be reduced to the intents `move`, `fire`, `bomb`, `pause`, `confirm`; gameplay must never know which device produced them.
- **Many consumers of the same events.** Score and chain (§8), audio (§9.5), HUD (§9.2), game feel (§9.4) and first-appearance labels (§7.3) all react to kills, pickups and deaths. Hard-wiring those consumers into the entities would couple the domain to presentation.
- **Owner requirements (fixed).** A complete UML study (use-case, class, state, sequence) validated before code (CLAUDE.md, "Design before code"); an architecture that is the developer's own, no game framework, no ECS (GDD §1.2, §11.4); the domain never imports the browser (CLAUDE.md); determinism and no allocation in the loop (ADR-0002); tests mandatory with TDD on the domain, a headless level simulation and exactly one browser smoke test (GDD §13, CLAUDE.md). The first commit is documentation only; tooling arrives with the vertical slice (PROJECT_LOG, "keep it simple first").

## Decision

**1. Entities are composed, not derived.** The entity kinds are `Player`, `Enemy`, `Bullet`, `Pickup`, `Boss`. An `Enemy` is a small record holding its runtime state (position, HP, timers) plus references to the strategies of its archetype. A `Boss` is an `Enemy` with a phase state machine and a timer. There is no `abstract class Enemy` hierarchy and no entity-component-system. Minimal interfaces (the fixed tick is implicit, ADR-0002):

```ts
interface MovementPattern { tick(self: EnemyState, world: WorldView): void }
interface AttackPattern   { tick(self: EnemyState, world: WorldView, spawn: BulletSpawner): void }
interface DropTable       { roll(random: Random): PickupKind | null }   // Random: ADR-0002
interface EnemyArchetype  {
  readonly stats: EnemyStats          // hp, hitbox, sprite, score
  readonly movement: MovementPattern
  readonly attack: AttackPattern
  readonly drops: DropTable
}
```

Archetypes are typed data: a level script (§7.1) references them by name; tuning values marked *(initial)* in the GDD live in these records, never in code paths.

**2. Each pattern is admitted by exactly one named force.**

| Pattern | Force it answers | Where |
|---|---|---|
| Strategy | Crossed movement × attack × drop behaviours (§5.2) | `MovementPattern`, `AttackPattern`, `DropTable`, weapon behaviour per level (§4.3) |
| State | Scene machine (§9.1) and boss phases (§6) | `SceneMachine`, `BossPhase` |
| Object Pool | No allocation in the loop (ADR-0002) | bullets, particles, pickups |
| Observer (event bus) | Many consumers of one event, no coupling | `EnemyDestroyed`, `FormationCleared`, `PickupCollected`, `PlayerDied`, `BossPhaseChanged`, `ChainStepped` |
| Command | Four devices, five intents (§4.2) | `IntentFrame` produced by `InputPort` each tick |
| Ports | The domain never imports the browser | `RenderPort`, `AudioPort`, `InputPort`, `Clock`, `StoragePort` |

A pattern not in this table needs a new force and a review justification before it enters the code.

**3. The event bus is synchronous and ordered.** `publish` dispatches immediately, in subscription order fixed at the composition root, within the tick that produced the event. No promises, no microtasks, no deferred queues. Handlers may publish further events; they are dispatched in the same way before `publish` returns. This keeps a run a pure function of (script, inputs, seed), which ADR-0002 requires.

```ts
interface EventBus {
  subscribe<E extends GameEvent>(kind: E['kind'], handler: (e: E) => void): Unsubscribe
  publish(event: GameEvent): void
}
```

**4. Ports and the dependency rule.** `src/domain` contains the simulation and depends only on port interfaces; `canvas`, `window`, `document`, `AudioContext`, `localStorage`, `performance.now`, `Date.now` and `Math.random` appear only under `src/adapters`. Enforcement is mechanical and two-fold: the domain is compiled with its own `tsconfig` whose `lib` excludes `DOM`, so a browser global fails type-checking; `Date.now`, `performance.now` and `Math.random` are part of the ECMAScript libs, so they are caught by the ESLint `no-restricted-globals` / `no-restricted-properties` rules scoped to `src/domain` (ADR-0002).

Each port is owned by exactly one ADR; this ADR only lists them and does not restate their signatures:

| Port | Owner | Role |
|---|---|---|
| `RenderPort` | ADR-0001 | Draw sprites, rectangles and text to the 240 × 320 off-screen canvas, present it |
| `Clock`, `Random` | ADR-0002 | Monotonic time in milliseconds; seeded PRNG |
| `InputPort` | this ADR | Produces one `IntentFrame` per tick (the intents of ADR-0002), never key codes |
| `AudioPort` | this ADR | `play(sfx)` and `music(track \| null)` |
| `StoragePort` | ADR-0006 | String read / write; the save schema belongs to the domain |

```ts
interface InputPort { read(): IntentFrame }   // IntentFrame = ReadonlySet<Intent> (ADR-0002)
interface AudioPort { play(sfx: SfxId): void; music(track: TrackId | null): void }
```

**5. Layering is flat and proportional.** Three directories: `src/domain` (rules, entities, strategies, state machines, level script parser, event bus), `src/adapters` (one implementation per port), `src/app` (composition root: wires adapters to ports, runs the loop of ADR-0002, instantiates the scene machine). No use-case or application-service layer; a further seam is added only when a second implementation or a test demands it. This layout is the single reference for every path-based rule in the other ADRs; the commit scopes map onto it (`game`, `engine`, `levels`, `i18n` → `src/domain`; `render`, `audio`, `input` → `src/adapters`; `ui` → both).

**6. UML-first.** For each feature the diagrams under `docs/architecture/diagrams/<feature>/` (use-case, sequence, component, class, state, data-flow as relevant) are validated before implementation; the class diagram is the contract for the composition above, the state diagrams for the scene machine and boss phases.

**7. Test strategy (pyramid, bottom-heavy).**

- *Unit tests on the domain, written with TDD (Red/Green/Refactor)*: collisions (4 × 4 player hitbox §4.1, 32 × 32 pickup collection §4.6), drop tables (30 %, 60 %, 100 %, formation guarantee §5.2), chain multiplier (2 s window, step every 5 kills, cap ×8, reset on death §8), scene machine transitions (§9.1), boss phases (66 % and 33 % thresholds, 90 s timer §6), death rules (§4.4), bomb rules (§4.5), level script parser (§7.1). Each test drives real domain objects with a fake `Clock` and a seeded `Random`.
- *Integration: headless level simulation.* The real domain runs a full level script with scripted `IntentFrame`s, a seeded RNG and null ports, then asserts outcomes: final score, number of deaths, whether and when the boss was reached, tally values, and that two runs with the same (script, inputs, seed) produce identical event logs.
- *End-to-end: exactly one Playwright smoke test* against the built bundle: the page loads, the canvas is present and has painted, and `Start` moves the scene machine to Playing.
- *Doubles only at the ports.* `RenderPort`, `AudioPort`, `InputPort`, `Clock`, `StoragePort` are faked or stubbed; domain objects are never mocked. No golden-image or screenshot comparison tests.
- Tooling: **Vitest** for the unit and simulation tests (they run in Node, ADR-0002), **Playwright** for the smoke test; both are wired with the vertical slice, one PR per brick.

## Alternatives considered

- **Entity-component-system (ECS)** — rejected because it is oversized for ~200 entities, data-oriented in a way that fights the UML class and state study, and adds a framework-like layer to a project whose goal is an architecture of the developer's own (GDD Decision record, §1.2, §11.4).
- **Classic inheritance tree (`Enemy` → `SmallEnemy` → `Diver` …)** — rejected because crossed behaviours (hover × aimed, hold × ring, cross × none) explode the tree or force a fat base class, and a sixth role would be new classes rather than a data line (§5.3).
- **TDD everywhere, including rendering and game feel** — rejected because flash, hit-stop, shake and particles are tuned by eye and ear; mandatory tests-first there slows iteration without catching regressions that matter (GDD Decision record, "TDD: Domain only").
- **Golden-image tests** — rejected as brittle: any palette, sprite or sub-pixel change breaks them, and they test the renderer, which ADR-0001 isolates behind a port.
- **Unit tests only** — rejected because level-level regressions (pacing, drops, boss timing) stay invisible without the headless simulation (GDD Decision record).
- **Game framework (Phaser)** — rejected in ADR-0001; it would dictate the composition and loop this ADR defines.

## Consequences

- Positive: enemies, bosses and weapons are data, so balancing (§14, question 3) and 1.x roles touch no logic; every rule in §4 to §9 maps to a small object with one responsibility and a unit test; the domain runs headless, which makes the level simulation, determinism checks and future replays (§11.3) possible; renderer, audio and input can each be replaced behind their port.
- Negative: composition needs discipline; the temptation to add `extends` or a quick `window` reference inside the domain is constant. Many small objects increase file count and require the UML class diagram to stay current. A synchronous bus means a slow handler blocks the tick, so handlers must stay O(1) and never do I/O.
- Code review rules created by this ADR: no `extends` between entity types; no DOM, `Date.now`, `Math.random` or `setTimeout` under `src/domain` (DOM by the domain `tsconfig`, the others by the scoped ESLint rules); every new pattern names its force; event handlers never publish asynchronously and never depend on subscription order they do not own; new tuning values go into archetype or `DifficultyProfile` data (§10), not into branches.
- Tests implied: unit coverage of every §4 to §9 rule listed in Decision 7; one headless simulation per level script (three in 1.0) plus a determinism test; the single Playwright smoke test as the only browser test; a test that compiles `src/domain` against a `tsconfig` without `DOM` as a guard.
- Follow-ups: the UML class, state and sequence diagrams for the composition root, the enemy archetype and the scene machine are the first entries of the UML study (docs/architecture/diagrams); the vertical slice PRs introduce the runner and Playwright.

## References

- GDD: §1.2 goals, §4.2 controls and intents, §5.2 roles, §5.3 composition model, §6 bosses, §7.1 level scripts, §8 scoring, §9.1 scene state machine, §10 difficulty profile, §13 technical constraints, Decision record (Architecture, Tests, TDD).
- Related ADRs: ADR-0001 (RenderPort, Canvas 2D), ADR-0002 (fixed timestep, seeded RNG, pools), ADR-0004 (delivery), ADR-0005 (licensing), ADR-0006 (StoragePort, `localStorage` schema).
- Gamma, Helm, Johnson, Vlissides, *Design Patterns: Elements of Reusable Object-Oriented Software*, Addison-Wesley, 1994 — Strategy, State, Observer, Command; "favor object composition over class inheritance".
- Robert Nystrom, *Game Programming Patterns* — Command, Observer, State, Object Pool, Game Loop: https://gameprogrammingpatterns.com/
- Glenn Fiedler, "Fix Your Timestep!": https://gafferongames.com/post/fix_your_timestep/
- Robert C. Martin, "The Clean Architecture" (dependency rule): https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Martin Fowler, "TestPyramid": https://martinfowler.com/bliki/TestPyramid.html
- Kent Beck, *Test-Driven Development: By Example*, Addison-Wesley, 2002.
- Playwright documentation: https://playwright.dev/docs/intro
- TypeScript `lib` compiler option: https://www.typescriptlang.org/tsconfig/#lib
- Michael Nygard, "Documenting Architecture Decisions" (ADR format): https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
