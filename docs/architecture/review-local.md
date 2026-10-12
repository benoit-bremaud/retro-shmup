# Local review — retro-shmup (branch `feat/boss-domain`)

- Date: 2026-10-12
- Commit: the F-2a commits + the review fixes
- Scope: branch diff `origin/main...HEAD` — F-2a of the boss fight: `fire`/`tick` patterns and
  group sequences, `swayMovement`, `Boss` and the Cruiser, `damageBoss`, collisions, `warningAt`,
  events 8 to 12, the level end, the grey boss drawing, the interim `Results` scene (ADR-0023)
- Checks run: design · docs · tests · security · correctness
- Verdict: **ship** · Must 0 open (1 fixed) · Should 6 fixed, 1 decided (RunRules in F-2b) · Nice 8

## 🔴 Must Have

_None open._ Fixed before the push:

- `src/domain/game/boss.ts` `[docs]` · the class doc cited a `damage` method that does not exist
  (`Run` calls `applyDamage`) · fixed.

## 🟡 Should Have

- `docs/architecture/traceability-matrix.md` `[docs]` · `Boss.pendingPhase` does not exist, the
  field is `movementPhase` · fixed.
- `tests/domain/level-simulation.test.ts` `[tests]` · the seeded replay compared only events,
  lives, outcome and ship; a drift of the boss's motion, HP or phase between events would pass ·
  fixed: the score and the boss view (state, position, HP ratio, phase, steps in state) are
  included.
- `tests/domain/boss-run.test.ts` `[tests]` · "destruction wins a tie with the timer" was only
  tested by a hand-run replay of `Run`'s step order · fixed: a `Run`-level test measures the step
  on which the timer runs out, then kills just before it (destruction only) and after it (escape).
- `tests/domain/boss.test.ts` `[tests]` · "starts the fight on the axis" never checked x 120 ·
  fixed.
- `src/domain/game/boss.ts` `[correctness]` · `start` does not validate its definition · decided:
  the definitions are repository data, so a test of the Cruiser definition (a positive duration
  per state, descending thresholds, entry at the fighting height) replaces run-time code. Note: an
  `entryS` of 0 does not give NaN (`Math.min` bounds the ratio), it teleports the boss.
- `src/domain/scenes/scene-machine.ts` `[correctness]` · `LevelCleared` (a list of several levels)
  is not handled · decided: unreachable in the one-level slice; a comment records that the
  next-level flow belongs to the screens brick.
- `src/domain/game/run.ts` `[design]` · `Run` is 505 lines, over the ~450 checkpoint of ADR-0023
  decision 7 · decided: extract `RunRules` as a pure move at the start of F-2b, the seeded replay
  as its oracle.

## 🔵 Nice to Have

- Fixed: the invented `CRUISER_TURRET` geometry is flagged as such; `warningS` and `entryS` say
  seconds; `hpRatio` says clamped at 0; `AXIS_X` reuses `FIELD_WIDTH / 2`; weak and redundant
  assertions in the boss tests.
- Left: `instanceof Boss` in `collision.ts` (a type-only import would do), `restartAttack`
  disarming and re-arming only to reload the timer, the turret blinking on the flash frame.

## ⚪ Disagree / Intentional

- The 8 px overhang of the box at the ends of the phase-2 sway is GDD v0.10 §6.1.
- The bullet-hit code is duplicated between `Boss` and `Enemy` (two copies): the rule of three
  waits for a third hit kind. The field reset of `Boss.start` repeats `Enemy.spawn`: no shared base
  class, per ADR-0003.
- The enemy-bullet peak is 39 of 48 in phase 2: within the GDD's cap of 40, so 9 slots stay free;
  the margin of 12 asked in the brief was stricter than the GDD and is not enforced.

## Per-dimension summary

- Design: the boss is a `Body` outside the pool, no role branch in strategies, no browser access,
  no allocation in the step; the one SRP pressure is `Run`.
- Docs: TSDoc on about 100 % of the new surface; the stale spots are fixed.
- Tests: 677 pass; GDD §6.1 and ADR-0023 are pinned by exact assertions; nothing from the domain
  is mocked.
- Security: nothing untrusted introduced.
- Correctness: timers, phases, collisions, events, `LEVEL_CLEARED` and the level director match
  the GDD and the ADR.
