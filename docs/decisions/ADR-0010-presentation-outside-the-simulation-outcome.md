# ADR-0010: Presentation never changes the outcome of a run

**Status:** Accepted — 2026-10-08. It refines ADR-0002 (random stream, time
scale), ADR-0003 (event bus ownership, `DropTable` shape) and ADR-0001 (HUD region); back-links
are added to those ADRs in a dedicated PR.

## Context

- Every game-feel effect must be switchable (GDD §9.3, §9.4, CLAUDE.md), and a run must be a pure
  function of (scripts, inputs, seed) (ADR-0002). The UML class study (2026-10-08) found three
  ways an effect toggle could change the result:
  - ADR-0002 lists the starfield among the consumers of the simulation's `Random`; if particles,
    shake or sway also drew from it, switching them off would shift every later drop roll;
  - hit-stop and slow motion implemented inside the simulation would change the boss timer and
    the chain window;
  - event handlers that mutate state would make the outcome depend on subscription order.
- Nothing owned the drawing of a run: HUD, effects, first-time pickup labels, score pop-ups and
  the event-to-sound mapping would have fallen into the scene machine.
- The HUD lives in the side bands, outside the 240 × 320 play field that `RenderPort`
  coordinates address (ADR-0001, GDD §9.2).
- The `DropTable` Strategy sketched by ADR-0003 cannot read a Carrier's script-given cargo.
- Scope note: decisions 5 and 6 are not presentation concerns strictly speaking; they are
  recorded here because the same class study surfaced them and each is small. They can be split
  into their own ADRs if they grow.

## Decision

1. **Two random streams.** The simulation's seeded `Random` serves **gameplay only** (drops,
   spawn variations). Presentation (particles, shake, starfield twinkle) uses its own unseeded
   generator. The starfield's positions are a pure function of scroll time.
2. **Time effects live in the loop.** Hit-stop and slow motion are a **time scale** the frame
   loop applies to the wall time it feeds the accumulator. The simulation still advances by
   fixed steps of 1/60 s and never knows the scale; the effect delays steps, it never changes
   them, so the boss timer, the boss bonus and the chain window are untouched. Disabled, the
   scale stays 1. Source and clock: each frame the loop asks `SceneMachine.timeScale()`, which
   delegates to `RunPresenter`; the presenter receives the unscaled wall time through
   `render(alpha, wallDtMs)` and times every effect in wall-clock milliseconds — never in
   simulation steps, otherwise a scale of 0 would never end.
3. **A `RunPresenter` owns the drawing of a run** (`src/domain`, presentation side): it reads
   the run's interpolated view, draws the play field and the HUD, owns the particle pool and the
   game-feel effects, shows first-time pickup labels and score pop-ups, and maps events to
   sounds. The scene machine delegates to it while a run is on screen.
4. **One event bus per run**, created with the run. Subscription order is fixed by the scene
   machine when it starts the run: `ScoreKeeper` first, then `RunPresenter`. Only `ScoreKeeper`
   mutates simulation state from a handler; spawning (pickups, death release) is a direct call
   in the step, never a handler. Event objects are preallocated, one per kind, and reused, under
   two invariants: a handler never keeps a reference to the event, and a handler never publishes
   an event of the kind it is handling. An event carries `kind`, `position`, `value`, `subject`
   (the serial of the entity concerned) and `detail` (a kind or a flag).
5. **`DropTable` is data**: `{ kinds, rate }`, read by one roll function; a cargo set on the
   enemy by the level script overrides it. This replaces the Strategy sketch of ADR-0003.
6. **`RenderPort` draws in two regions**: the play field (240 × 320) and the HUD bands. The
   method set of ADR-0001 is unchanged; a `setRegion('field' | 'hud')` call selects the
   coordinate space. Exact signature frozen in the class study of the render seam.

## Alternatives considered

- **One random stream for everything** — rejected: an effect toggle would change the run.
- **Hit-stop inside the simulation** — rejected: changes the boss timer and the chain window.
- **Effects drawn by the scene machine** — rejected: a God object mixing navigation and drawing.
- **One application-wide bus** — rejected: listeners of a finished run would leak into the next.
- **`DropTable` as a Strategy hierarchy** — rejected: three classes for a two-field record, and
  the cargo could not be expressed.

## Consequences

- Positive: switching any effect is outcome-neutral by construction; the headless simulation
  tests need no presentation; the scene machine stays a navigator.
- Negative: two generators to keep apart; the loop carries a time scale.
- Tests implied: one level simulated twice with every effect on, then off, gives the same event
  log; a lint rule forbids the presentation code from importing the simulation's `Random`.

## References

- GDD v0.3 §5.2, §9.2–§9.4; ADR-0001, ADR-0002, ADR-0003, ADR-0009.
- Glenn Fiedler, "Fix Your Timestep!": https://gafferongames.com/post/fix_your_timestep/
- Robert Nystrom, *Game Programming Patterns*, "Observer" and "Event Queue":
  https://gameprogrammingpatterns.com/
