# ADR-0022: Level brick — strategy factories, the boss outside the enemy pool, a one-level slice ending at RUN_CLEARED

**Status:** Accepted — 2026-10-12. **Partially supersedes ADR-0003**: in decision 1, the sentence
"A `Boss` is an `Enemy` with a phase state machine and a timer." becomes "A `Boss` is a `Body`,
like an `Enemy`, with a state, phase data and a timer; it is not an `Enemy` and does not come
from the enemy pool" (decision 3 below). Every other part of ADR-0003 stands: composition, no
`extends` between entity types, no ECS, stateless strategies with their state on the body,
tuning as data, the pattern table. Values are GDD v0.10 values (§5.2.1, §6, §6.1, §7.2.2, §8,
§9.1, §9.2, §9.4); interim deviations are recorded only in the scene machine
(`meta/05-state-scenes`, level brick additions).

## Context

- ADR-0003 decision 1 says a boss "is an `Enemy`". The class study has drawn `Boss` as a second
  realization of `Body` since 2026-10-08 (`Body <|.. Enemy`, `Body <|.. Boss`), never as an
  `Enemy`: the `Enemy` record carries an archetype, a formation and a cargo the boss has no use
  for, and the enemy pool of 16 is sized for waves. The decision text and the model disagree.
- The strategies are module constants today (`EnterHoldLeave`, `AimedAttack` in
  `movements.ts` and `attacks.ts`) that read their timings from `GunnerTuning`. The Heavy uses the
  same enter-hold-leave movement with other values (2 s in, 10 s hold, 40 px/s out, GDD v0.10
  §5.2.1), and needs a ring and a fan; the Cruiser needs a sway, a ring of 16 turning every
  volley, an aimed triple and patterns that alternate (§6.1). Copying a constant per role would
  duplicate the code; reading the role inside the strategy would make it a branch on the role.
- A rotating ring needs to know which volley it is firing; strategies are stateless and keep
  per-body state on `Body` (ADR-0003), which has no volley count.
- `LevelScript.loopAt` wraps the interim 45 s script (enemies brick); the level brick ends the
  level with a warning and a boss, so a script ends instead of looping.
- The vertical slice has one level (GDD v0.10 §2, §9.1). The 1.0 flow goes from the results to
  the next level or the Ending; the Ending and the name entry arrive with the screens brick (G).
- The conception study of the level brick (2026-10-12) validated the GDD rules one at a time with
  a scored recommendation, and the technical batch below as a whole.

## Decision

1. **Strategies are built once, by factories, from tuning data.** A factory returns a frozen
   strategy object closed over its configuration, converted to steps at load:
   `enterHoldLeave({ travelS, holdS, leaveSpeed })`, `ringAttack({ count, periodS, speed,
   rotateDeg })`, `fanAttack({ count, spreadDeg, periodS, speed })`, `aimedAttack({ periodS,
   speed })`, `swayMovement({ amplitude, periodS })`, `sequenceAttack([...], periodS)` (one volley
   every `periodS`, patterns taking turns; the inner patterns' own `periodS` is ignored) and
   `parallelAttack([...])` (each pattern firing on its own period, at the same time). They run at module load, never in the loop; the archetypes and the
   boss phase specs hold the results. The Gunner and the Heavy share `enterHoldLeave` with two
   configurations, and the Gunner's refactor changes no behaviour (its tests stay green). The
   strategy interfaces of ADR-0003 do not change; this is ADR-0003's "tuning as data" applied to
   the strategies' own parameters — no inheritance, no ECS, no role branch.
2. **`Body.volleys`.** `Body` gains `volleys: number[2]`, one volley counter per pattern of a
   `parallelAttack`; `sequenceAttack` and a single pattern use index 0. Both are reset on spawn
   and on a phase change. A ring turns by `rotateDeg` × its count (every other volley for the
   Heavy's 15°, every volley for the Cruiser's 11.25°); `sequenceAttack` picks its pattern from
   `volleys[0]` and gives pattern i its own index ⌊`volleys[0]` / n⌋. A fixed array of two, so
   nothing is allocated per spawn. Every pattern is a pure function of the body, the ship's
   position and its count: no random draw, so a replay is identical.
3. **The boss is one preallocated body outside the enemy pool.** `World` owns one `Boss` that
   realizes `Body`, with a state — `IDLE`, `WARNING`, `ENTERING`, `FIGHTING`, `DESTROYED`,
   `FLEEING` — its phase index and its timer in steps. `Boss.start()` takes a fresh serial from
   the run-scoped counter, like `Enemy.spawn`. It is reset from a `BossDefinition`
   (stats, timer, entry, phases) whose `BossPhaseSpec`s hold the HP threshold, the movement and
   attack strategies and the broken part. `SizeTier` gains `LARGE` (the Heavy); the boss has its
   own explosion size. A level has exactly one boss, so a pool of one would be ceremony.
4. **The director starts the boss.** `LevelScript` gains `warningAt` and `boss`, both required,
   and loses `loopAt`. At `warningAt` the `LevelDirector` stops spawning and calls
   `EnemySpawner.startBoss(definition)`; the load check rejects a spawn at or after
   `warningAt` − 4 s.
5. **Damage to the boss goes through `HitRules.damageBoss(amount)`.** Collision pass 1 includes
   the boss among the nearest-target candidates only while it is `FIGHTING` (a Laser bolt
   remembers its serial like any body); pass 3 tests its body against the ship in `ENTERING` and
   `FIGHTING`; the bomb calls `damageBoss` only in `FIGHTING`. `damageBoss` applies the damage,
   publishes `ENEMY_HIT` with the boss serial and advances a phase per threshold crossed, so a
   bomb can advance a phase.
6. **Events and outcomes.** `GameEventKind` gains `BOSS_WARNING` (8), `BOSS_PHASE_CHANGED` (9),
   `BOSS_DESTROYED` (10, `value` = seconds left), `BOSS_FLED` (11) and `LEVEL_CLEARED` (12,
   `value` = bombs left), within the bus's bitmask. `RunOutcome` gains `LEVEL_CLEARED` and
   `RUN_CLEARED`; the run holds a data-driven list of level scripts, and the end of the last one
   sets `RUN_CLEARED` — in the slice the list holds level 1 only, so level 1's end is
   `RUN_CLEARED`.
7. **The tally is a subscriber.** `LevelTally`, owned by `ScoreKeeper`, subscribes to
   `FORMATION_CLEARED`, `BOMB_USED`, `PLAYER_DIED` and `LEVEL_CLEARED`; on `LEVEL_CLEARED` it
   records the bombs left and `ScoreKeeper` adds the total flat. The boss bonus is added on
   `BOSS_DESTROYED`, flat. `RunView.tally()` exposes it read-only; the values live in
   `TallyTuning`.
8. **Presentation reads the snapshot.** The `hud` font gains a space glyph (an empty cell),
   so the Results values (`3 × 500  1 500`, `5 000`) draw through the `RenderPort` glyph-set
   contract, which otherwise throws on a space; F-3 adds it to `src/domain/ports/render-port.ts`
   and the `hud` glyph table. `WorldSnapshot` gains a boss view (state, position, HP
   ratio, seconds left, phase); the presenter draws the boss, the HP bar and the seconds, the
   WARNING banner from the boss state (not from an event, so a pause cannot lose it), the debris
   on `BOSS_PHASE_CHANGED`, the Large and boss explosion tiers, and the slow motion as a time
   scale (ADR-0010 decision 2) behind a new `EffectSettings.slowMotion`, on by default and off
   under `prefers-reduced-motion`.
9. **A one-level slice ends at `RUN_CLEARED`.** The scene machine gains `Results` (values in
   `ResultsTuning`: 1 s lock, 8 s automatic exit, 0.5 s per line); `RUN_CLEARED` → `Results` →
   `Title`. The 1.0 transitions (`LEVEL_CLEARED` → next level card, `RUN_CLEARED` → `Ending` →
   name entry) are unchanged in the diagram; going to the title instead is an interim deviation
   until the screens brick (G).
10. **Delivery in four PRs, each merge playable.** F-0 this design; F-1 the strategy factories
    (the Gunner refactor first, with no behaviour change), the Heavy, the ring and the fan, and
    the 120 s script (interim: it still wraps at 120 s until F-2); F-2 the boss (`warningAt`,
    `startBoss`, the boss state machine, the Cruiser, `damageBoss`, the events, the snapshot, the
    HP bar, the seconds and the WARNING, the debris, the slow motion, `loopAt` removed; interim:
    `RUN_CLEARED` shows a "LEVEL CLEAR" banner for 3 s, then the title); F-3 the tally, `Results`
    and `RUN_CLEARED` → `Results` → `Title`, and the documentation pass.

## Alternatives considered

- **The boss as a pooled `Enemy`** (the ADR-0003 wording) — rejected: it would carry an
  archetype, a formation and a cargo it never uses, take one of the 16 wave slots, and put boss
  branches in every enemy path (sweep, despawn, drop).
- **A strategy constant per role** (`HeavyEnterHoldLeave`, `HeavyRing`…) — rejected: duplicated
  code differing only by numbers, against ADR-0003's tuning-as-data rule.
- **Strategies reading the archetype to pick their values** — rejected: a branch on the role
  inside the strategy, the Open/Closed failure §5.3 forbids.
- **An inheritance tree of attacks or a component system** — rejected by ADR-0003 (no `extends`
  between entity types, no ECS); factories return plain objects.
- **The ring angle from the body's age** — rejected: it ties the rotation to the period and the
  first-volley delay; a volley count states the rule directly.
- **Keeping `loopAt` beside `warningAt`** — rejected: two ways to end a script; the interim loop
  ends with the boss.
- **Looping level 1 harder, or Game over after level 1** — rejected in the GDD Decision record
  ("After level 1", 15/35 and 11/35).

## Consequences

- Positive: a new role or pattern is a factory call with data; the Gunner and the Heavy share
  one movement; the boss is a small separate object with its own state diagram
  (`gameplay/05-state-boss`); the tally needs no new call in the step; the slice ends cleanly and
  level 2 is a list entry.
- Negative: `Body` grows by two counters; the run, the collision passes and the bomb gain a boss
  branch each; strategies are now built objects, so the class diagram names factories rather than
  singletons.
- Code review checks: no factory call inside the loop; no role test inside a strategy; the boss
  never acquired from the enemy pool; boss damage only through `damageBoss` and only in
  `FIGHTING`; `BOSS_DESTROYED` and the tally scored flat; no spawn at or after `warningAt` − 4 s.
- Tests (ADR-0003 pyramid): the Gunner unchanged after the refactor; the Heavy's 2 s entry, 10 s
  hold and 40 px/s exit; a ring of 12 turned by 15° on every other volley and a fan of 5 centred
  on the aim; the Cruiser's sway, its phase-1 alternation, its phase-2 ring turning 11.25° per
  volley and its triple (`parallelAttack`, each on its own period); the phase change on a threshold, including two thresholds crossed by one
  bomb; no damage before `FIGHTING`; the bomb ignored in `WARNING` and `ENTERING`; contact in
  `ENTERING` and `FIGHTING` only; timer expiry → `FLEEING`, destruction winning a tie; the bonus
  10 000 + 100 × seconds left, flat; the `hud` font drawing a space and still throwing on other characters; the tally lines (a bomb-completed formation counted, a shield
  absorb keeping the no-miss); the load check at `warningAt` − 4 s; the level simulation at
  ≤ 16 enemies and ≤ 40 enemy bullets — the boss fight included, with phase 2 held for its whole
  timer — and its determinism with every effect on and off; the
  scene machine's `Results` lock, automatic exit and pending pause.

## References

- GDD v0.10 §2, §5.2, §5.2.1, §6, §6.1, §7.1, §7.2, §7.2.2, §8, §9.1–§9.4, §9.7, Decision record
  ("Level 1 length" to "Boss staging"); ADR-0002, ADR-0003, ADR-0010, ADR-0019;
  `docs/architecture/diagrams/gameplay/04-class-domain.md`, `05-state-boss.md`,
  `02-sequence-boss-fight.md`; `docs/architecture/diagrams/meta/05-state-scenes.md` (level brick
  additions).
- Gamma, Helm, Johnson, Vlissides, *Design Patterns*, 1994 — Strategy, Factory Method.
- Michael Nygard, "Documenting Architecture Decisions":
  https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
