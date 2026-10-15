# Local review — retro-shmup (feat/balance-bot)

- Date: 2026-10-16
- Scope: branch diff origin/main...HEAD (GDD v0.18 values applied, ring-of-14 amendment, balance bot and guard, re-derived tests)
- Checks run: design (architecture-guardian) · docs (design-vs-code drift audit) · tests (test-auditor) · security · correctness (full suite, mutation checks)
- Verdict: ship · Must 0 · Should 0 open (12 fixed) · Nice 4

## 🔴 Must Have

_None._

## 🟡 Should Have

_None open._ Fixed in this branch:
- `tests/support/average-player.ts` `[design]` · ship speed, clamps and step rate copied by hand → imported from `PlayerTuning`, `FIELD_WIDTH`, `STEPS_PER_SECOND`; decision thresholds named; power read as `fullPowerS`, not by index.
- `tests/balance/level-1-balance.test.ts` `[design|tests]` · 300 runs at collection time → `beforeAll` with its own timeout; `BALANCE_SEEDS` validated; full-power share asserted (the median alone ignored runs that never got there); fight-time comment says what it counts.
- `tests/domain/boss.test.ts` `[tests]` · the Cruiser's 85 px/s fan and triple were never asserted → asserted (mutation to 75 fails).
- `tests/domain/level-simulation.test.ts` `[tests]` · seed 10 documented with how it was found.
- `05-state-boss.md`, `04-class-domain.md`, `traceability-matrix.md`, `CHANGELOG.md`, `cruiser.ts` comment `[docs]` · six leftover pre-v0.18 statements aligned.

## 🔵 Nice to Have

- `tests/support/average-player.ts` `[tests]` · no sanity test of the bot itself (a passive bot should end in game over).
- `tests/support/average-player.ts` `[design]` · file name for three profiles (`player-bot.ts`).
- `tests/domain/level-simulation.test.ts` `[tests]` · the phase-2 bullet peak is exactly the limit of 40 (correct, zero margin).
- `tests/balance` `[tests]` · a separate `test:balance` project if the suite grows slow (5 s today).

## ⚪ Disagree / Intentional

- The bot is not merged with `dodging()` in the level simulation: a deterministic regression pilot vs a probabilistic player model (two uses, no Rule of Three).
- `for...of` in `tests/support`: the ban covers `src/` only (CLAUDE.md).
- Collision and tally tests read `GUNNER.stats.hp` / `CRUISER.stats.hp`: they test arithmetic; the values are pinned against the GDD in `enemy.test.ts` and `boss.test.ts`.

## Per-dimension summary
- Design: data-only production change, flat bot, no Must · Docs: GDD, UML, matrix, README, CHANGELOG match the code · Tests: 1 246 green, expectations re-derived from v0.18, mutation checks on the 70 s P, ring of 16, Cruiser speeds · Security: no new input, sink or dependency · Correctness: phase-2 peak 40 ≤ limit, bot figures unchanged by the refactor
