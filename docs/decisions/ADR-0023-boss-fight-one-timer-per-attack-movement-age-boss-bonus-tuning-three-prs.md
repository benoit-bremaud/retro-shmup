# ADR-0023: Boss fight — patterns split into `fire` and `tick` with one timer per attack, `age` as movement time, the bonus in `BossTuning`, F-2 in three PRs

**Status:** Accepted — 2026-10-12. **Partially supersedes ADR-0022**: decision 1 (the factory list
loses `parallelAttack` and `sequenceAttack` takes groups), decision 2 (`Body.volleys` stays, but
the count a pattern receives is the volley index, not ⌊count / n⌋), decision 3 (the
`BossDefinition` fields, the meaning of `age`) and decision 10 (the delivery of F-2). Decisions 4
to 9 stand unchanged. Values are GDD v0.10 values (§6, §6.1); no GDD rule changes.

## Context

- The planning of F-2 (2026-10-12, read against the code at `1a6a2c3`) found four points the
  ADR-0022 does not settle.
- **The Cruiser's phase 2 fires two patterns on two periods** (GDD §6.1: a ring of 16 every
  1.5 s, an aimed triple every 3 s). `Body` has one `fireTimer`, and every pattern is a
  timed object: `ringAttack`, `fanAttack` and `aimedAttack` wait for the timer and read
  `volleys[0]` themselves. `sequenceAttack` therefore cannot call an inner pattern without its
  timer, which ADR-0022 decision 1 already requires ("the inner patterns' own `periodS` is
  ignored"), and ADR-0022's `parallelAttack` would need a second timer on every body.
- **The two periods are phase-locked.** 3 s is twice 1.5 s and both start at the phase change
  (GDD §6.1: "its first ring and first triple fire 1.5 s and 3 s after the change"), so the
  triple fires exactly on every second ring volley. One timer of 1.5 s, with the triple riding on
  every second volley, gives the same instants as two independent timers.
- **The sway cannot be a stateless closed form of the fight time.** GDD §6.1: at the phase change
  the sway "keeps its phase-1 path until the Cruiser next passes x 120, then follows the phase-2
  path from there in the same direction". `Body.age` counts steps since spawn for an enemy, and no
  rule says what it means for a boss.
- **`BossDefinition` is under-specified, and the bonus has no owner.** The ADR says "stats, timer,
  entry, phases"; the class diagram adds `bonus` and `bonusPerSecond`. `ScoreKeeper` does not know
  the definition: `BOSS_DESTROYED` carries only the seconds left, and the GDD gives one formula
  for the bosses (10 000 + 100 × seconds, §6).
- **The WARNING blink has no input.** ADR-0022 decision 8 draws it from the boss state, not from an
  event, but the planned boss view has no step count to blink with.
- **F-2 as one PR is too large to review**: the boss state machine, `damageBoss`, five events, the
  outcomes, the level end, the snapshot, the HP bar, the WARNING banner, the debris, the slow
  motion and the removal of `loopAt`.
- The state diagram `05-state-boss` fires `LEVEL_CLEARED` on `Destroyed → Idle`, while the sequence
  diagram and the class diagram (step 8) publish it only when the ship is not `Dead`; the
  sequence is right.

## Decision

1. **Every attack pattern is a `fire` and a `tick`.** A factory returns a frozen `AttackPattern`
   with `fire(self, world, spawn, count)` — one volley for the given count, with no timing — and
   `tick(self, world, spawn, dt)` — the timed wrapper that waits for `fireTimer`, calls `fire`
   with `volleys[0]` and counts the volley. The Gunner and the Heavy keep `tick` and behave
   exactly as in F-1 (their tests stay green).
2. **`sequenceAttack(groups, periodS)` takes groups.** It fires one volley every `periodS`; volley
   *i* fires every pattern of group *i* mod *n* through their `fire`, all with the count `i`
   (`volleys[0]`, from 0). The inner patterns' own `periodS` is ignored. The Cruiser is:
   - phase 1, `sequenceAttack([[fan], [ring]], 1)` — the first volley, a fan, 1 s into the
     fight; the phase-1 ring does not turn (`rotateDeg` 0);
   - phase 2, `sequenceAttack([[ring], [ring, triple]], 1.5)` — the ring turns by 11.25° × the
     volley index, which is the number of rings fired since the change because it fires on every
     volley; the triple fires on every second volley, 3 s after the change.
   `parallelAttack` and `Body.volleys[1]` are not used. This satisfies "each pattern keeps its own
   count" (GDD §6.1) for the Cruiser because its ring fires on every volley. A boss whose periods
   are not multiples of one another would need independent timers; `parallelAttack` is added
   then, as an extension that removes nothing.
3. **`Body.age` is the number of steps since the current movement began.** For an enemy and a
   pickup that is the age since spawn, as today. For the boss it restarts at every phase change
   (and at the start of the fight). `swayMovement({ amplitude, periodS })` is a closed form of
   `age` around x 120, its direction given by `Body.mirror`. The `Boss` holds a pending phase:
   when the HP crosses a threshold the attack switches at once and the boss keeps its movement
   until `x − 120` changes sign, then snaps to x 120, switches the movement, restarts `age`,
   `fireTimer` and `volleys`, and sets `mirror` to the direction it was moving in, so the body
   never jumps.
4. **`BossDefinition` holds the fight, not the score.** Its fields: `stats`, `phases:
   BossPhaseSpec[]` (`hpThreshold` in tenths, `movement`, `attack`, `brokenPart`), `timeLimit`,
   `warningS`, `entryFrom`, `entryTo`, `entryS`, `fleeSpeed` and `destroyedS`. `bonus` and
   `bonusPerSecond` leave the diagram: the bonus is `BossTuning.bonus` (10 000) and
   `BossTuning.bonusPerSecond` (100) in `tuning.ts`, read by `ScoreKeeper` on `BOSS_DESTROYED`
   (`value` = seconds left), flat, as ADR-0022 decision 7 says. If a later boss pays differently,
   the two numbers move into its definition then. `TallyTuning` keeps only the tally lines of
   GDD §8.
5. **The boss view of the snapshot carries `stateSteps`** (the steps spent in the current state)
   and `previousPosition`, so the WARNING banner blinks from the state, never from wall time, and
   the boss interpolates like any body.
6. **F-2 is delivered in three PRs, each merge playable.** F-2-0 is this design. F-2a is the
   domain: the factories above, `Boss` and `BossDefinition`, the Cruiser, `startBoss`,
   `damageBoss`, the bomb branch, events 8 to 12, the outcomes, the level end, `loopAt` removed;
   the boss is drawn as grey rectangles, and the interim `Results` scene shows a "LEVEL CLEAR"
   banner for 3 s, then the title (EN "LEVEL CLEAR", FR "FIN DU NIVEAU"). F-2b adds the HUD: the
   WARNING banner, the HP bar with the 66 % tick and the seconds left. F-2c adds the game feel:
   the debris, the Large and boss explosion tiers, `EffectSettings.slowMotion` and the time scale.
   F-3 stays the tally, the real `Results` and the documentation pass.
7. **A size checkpoint for `Run`.** `Run` is 347 lines today and F-2a adds about five boss-touching
   methods (`startBoss`, `damageBoss`, `advanceBoss`, the bomb branch, the level end). At the F-2a
   review, if `Run` exceeds about 450 lines or a sixth boss-touching rule method appears, a
   `RunRules` collaborator is extracted in the next PR as a pure move behind `HitRules`, with the
   seeded replay log as its oracle.
8. **The `05-state-boss` diagram follows the sequence diagram.** `Destroyed → Idle` and
   `Fleeing → Idle` end the boss sequence; `Run` publishes `LEVEL_CLEARED` at step 8, once, only
   when the ship is not `Dead`, and `GAME_OVER` wins over it.

## Alternatives considered

- **`parallelAttack` with a second timer** (ADR-0022 as written; "P" in the study) — rejected for
  now: it adds a field to every body and a factory for a need that does not exist, and the
  Cruiser's periods are phase-locked. It scored 79 against 86 for groups; the choice is cheap to
  reverse because the groups are a subset of it.
- **A `phaseAge` field on `Body`** — rejected: every body would carry it, or the sway would not work
  on an enemy; redefining `age` once is simpler.
- **`age` as life age plus a `phaseStart` offset** — rejected: it complicates every boss movement.
- **The bonus in `BossDefinition`** (the diagram) — rejected: `ScoreKeeper` would need the active
  definition for a formula the GDD gives once. **In `TallyTuning`** (ADR-0022 wording) — rejected:
  the boss bonus is §6, the tally lines are §8, and F-2 needs the numbers before F-3.
- **One F-2 PR** (ADR-0022 decision 10) — rejected: domain, presentation, effects, scenes and
  documents in one review.
- **Extracting `RunRules` before F-2** — rejected: the boundary is better drawn with the real code
  of `damageBoss` in front of us; the checkpoint in decision 7 bounds the risk.

## Consequences

- Positive: the Cruiser needs no new field on `Body`; the Gunner and the Heavy are untouched; the
  sway never jumps; the bonus has one owner; three small PRs.
- Negative: `fire` and `tick` double the surface of each pattern; a boss with incommensurate
  periods will need `parallelAttack` and a second timer; `age` means "since the current movement
  began", which every movement author must know.
- Code review checks: no pattern reads `volleys` inside `fire`; `sequenceAttack` passes the volley
  index and nothing else; the boss restarts `age`, `fireTimer` and `volleys` together at a phase
  change; `ScoreKeeper` reads `BossTuning`, not a definition; `LEVEL_CLEARED` published once and
  never while the ship is `Dead`.
- Tests (ADR-0003 pyramid): the Gunner and the Heavy unchanged; `fire` of each pattern for a given
  count; `sequenceAttack` for phase 1 (fan then ring, the ring not turning) and phase 2 (a ring
  turned by 11.25° per volley, the triple on volleys 1, 3, 5…, the first at 3 s); the sway through a
  phase change from both directions (no jump, `mirror` kept); the boss states and timers; the
  headless level simulation with phase 2 held for its whole timer at ≤ 40 enemy bullets and a
  margin in the pool of 48; the seeded replay identical through the boss.

## References

- GDD v0.10 §6, §6.1; ADR-0002, ADR-0003, ADR-0010, ADR-0019, ADR-0022;
  `docs/architecture/diagrams/gameplay/04-class-domain.md`, `05-state-boss.md`,
  `02-sequence-boss-fight.md`; `docs/architecture/diagrams/meta/05-state-scenes.md`.
- Gamma, Helm, Johnson, Vlissides, *Design Patterns*, 1994 — Strategy.
- Michael Nygard, "Documenting Architecture Decisions":
  https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
