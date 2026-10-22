# Local review — retro-shmup (feat/game, #130)

- Date: 2026-10-23
- Commit: 6a6a0e5
- Scope: branch diff main...HEAD
- Checks run: design · docs · tests · security · correctness
- Verdict: ship as-is  ·  Must 0 · Should 0 · Nice 1

## Pre-merge gate (head SHA 6a6a0e5)
| Step | Result |
|---|---|
| 1 Tests | ✅ 1648 unit / simulation / balance · ✅ 6 smoke (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.24 % stmts / 95.68 % branches / 100 % funcs / 99.91 % lines (floor 80) · docs 99.5 % (floor 90) |
| 3 SonarQube | ✅ PASSED (S5906 on the first scan fixed in 6a6a0e5) |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive |
| 5 QA pass | ✅ full · console clean · a run played, a life lost, power back to level 1: `qa/2026-10-23-death-reset-run.jpg` |
- Gate: **GREEN — merge authorised** (after owner approval)

## 🔴 Must Have
- Fixed: `docs/architecture/diagrams/gameplay/04-class-domain.md` `[design]` · `PickupMotion` still drawn · removed from the diagram and the traceability matrix.

## 🟡 Should Have
- Fixed: `tests/domain/pickups.test.ts` `[tests]` · stale death-release test · deleted.
- Fixed: `tests/domain/bomb-shield.test.ts` `[tests]` · no last-life test · added.
- Fixed: `src/domain/game/player.ts` `[docs]` · fly-in `reset()` comment · reworded.

## 🔵 Nice to Have
- `tests/balance/level-1-balance.test.ts:61` `[tests]` · loose bands (game over ≤ 99 %, boss ≥ 1 %) · owner choice (MCDA A, 415/500) until the playtest.

## ⚪ Disagree / Intentional
- ADR-0019 / ADR-0010 still name `powerDown` and the release · superseded by the GDD v0.29 decision record; ADRs change in their own PR.

## Per-dimension summary
- Design: no over-engineering, one-value enum removed · Docs: GDD row, CHANGELOG, UML in sync · Tests: TDD red/green, last life covered · Security: no finding · Correctness: no bug (no pickup can be caught while Dead)
