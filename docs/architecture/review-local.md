# Local review — retro-shmup (fix/game: #106, #107)

- Date: 2026-10-16
- Commit: fix/game head (after the review fixes)
- Scope: branch diff origin/main...HEAD
- Checks run: design · docs · tests · security · correctness
- Verdict: ship — every Must resolved · Must 0 open (4 fixed) · Should 1 open · Nice 4 open

## Pre-merge gate
| Step | Result |
|---|---|
| 1 Tests | ✅ 1427 unit/simulation/balance (Vitest) · ✅ 6 smoke (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.26 % stmts / 95.67 % branches / 100 % funcs / 99.9 % lines (floor 80) · docs: no new public symbol |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive |
| 5 QA pass | ✅ full · console clean · screenshot: docs/architecture/qa/2026-10-16-collision-fix-run.png (6 × 6 cockpit, Spread run) |
- Gate: **GREEN**

## 🔴 Must Have (all fixed)
- `tests/domain/collision-regressions.test.ts` `[tests]` · the "next bolt" test could not catch a pass-through regression · now asserts the farther enemy untouched after bolt 1.
- `tests/domain/collision-regressions.test.ts` `[tests]` · headless wing cases passed even if the bullet never arrived · now assert the bullet crossed the ship's row.
- `README.md`, `CHANGELOG.md`, GDD §4.3 ratio sentence `[docs]` · still said the Laser passes through · corrected; CHANGELOG Changed/Fixed entries added.
- `src/domain/game/bullet.ts`, `weapon.ts` `[docs]` · pierce comments stale · reworded.

## 🟡 Should Have
- Process `[design]` · GDD revision in the same PR as the code (CLAUDE.md: own PR) · owner waiver 2026-10-16, noted in the PR body.
- Duplicated `Rules` / `vulnerableWorld` / `enemyAt` `[design|tests]` · fixed: `tests/support/collision.ts`.

## 🔵 Nice to Have
- ADR-0019 context still justifies the pierce memory by a piercing Laser `[docs]` · follow-up note in a dedicated PR.
- `02-sequence-enemy-destroyed.md` "Piercing" heading describes dormant machinery `[docs]`.
- The anti-tunnelling test lists bullet speeds by hand `[tests]` · commented; a derived list would be stronger.
- `weapon.test.ts` `%d` on 1.5 / 2.5 damage in titles `[tests]`.

## ⚪ Disagree / Intentional
- Pass-through machinery kept with zero data users `[design]` · owner decision, GDD v0.24 decision record; still tested on synthetic shots.
- Balance bands widened `[tests]` · owner chose the 6 × 6 hitbox for a playtest (GDD v0.24 decision record); bands set to the measured values until the playtest settles them.

## Per-dimension summary
- Design: data-only fix, domain stays pure. · Docs: stale pierce wording fixed. · Tests: two false-confidence tests fixed, helpers shared. · Security: none. · Correctness: none.
