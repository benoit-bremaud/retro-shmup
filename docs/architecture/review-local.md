# Local review — retro-shmup (branch `docs/audit-pass`)

- Date: 2026-10-12
- Commit: `41a02d3` + the Should fix of this review
- Scope: branch diff `origin/main...HEAD` — docs and tests only: TSDoc on the audit's gaps, an
  EN/FR key-parity test, sturdier assertions, the README and traceability indexes, the log
- Checks run: docs · tests · correctness (a code and docs diff with no behaviour change)
- Verdict: **ship** · Must 0 · Should 1 (fixed) · Nice 3

## 🔴 Must Have

_None._

## 🟡 Should Have

- `src/domain/game/tuning.ts:133`, `PROJECT_LOG.md` `[docs]` · "the 30-bullet peak" was stated as
  exact but the test only asserts 24 to 36 · fixed: reworded to "about 30, asserted between 24
  and 36".

## 🔵 Nice to Have

- `src/domain/i18n/messages.ts` `[docs]` · `MESSAGES` is exported for the parity test; an
  `@internal` tag is optional.
- `src/domain/game/tuning.ts` `[docs]` · the shared "Pools of the enemies brick" comment now sits
  on `ENEMY_POOL_SIZE` only; acceptable.
- `tests/domain/level-simulation.test.ts` `[tests]` · "seed changes the drops" still asserts
  `logs.size > 1`; pinning two named seeds would fail more clearly.

## ⚪ Disagree / Intentional

- Exporting `MESSAGES` for a test is cheap and honest; the catalogue stays internal to the domain.

## Per-dimension summary

- Docs: archetype HP in tenths verified against the level-1 shot (1, 1, 8 and 4 shots); the ADR-0022
  link exists; the traceability scope is accurate; the log is reverse-chronological.
- Tests: assertions are logically equivalent and stronger; EN/FR parity is now enforced (580 tests).
- Correctness / security: no behaviour change, nothing untrusted touched.
