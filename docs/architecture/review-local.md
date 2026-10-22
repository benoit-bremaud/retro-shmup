# Local review — retro-shmup (feat/game-default-high-scores)

- Date: 2026-10-22
- Scope: branch diff origin/main...HEAD (default High scores table, #128, GDD v0.28 §9.1)
- Checks run: design (architecture-guardian) · docs (doc-auditor) · tests (test-auditor) · security + correctness (read inline: no I/O, no new input path)
- Verdict: ship — Must 0 · Should 0 open (6 fixed) · Nice 5 (below)

## Pre-merge gate

| Step | Result |
|---|---|
| 1 Tests | ✅ 1 651 unit/integration (Vitest) · ✅ 6 smoke (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.24 % stmts / 95.7 % branches (floor 80) · docs 99.5 % (floor 90) |
| 3 SonarQube | ✅ PASSED (make verify) |
| 4 Secrets | ✅ gitleaks clean (origin/main..HEAD) · only `.env.example` tracked · diff read: nothing sensitive |
| 5 QA pass | ✅ fresh profile shows the ten fictional players with flags · console clean · docs/architecture/qa/2026-10-22-default-high-scores.png |

- Gate: **GREEN** for the push; the merge gate re-runs on the merged SHA.

## 🔴 Must Have

_None._

## 🟡 Should Have

- `tests/domain/save-store.test.ts` `[tests]` · newer-save test name claimed more than it checked; v1 without key, invalid options with valid table and a present-but-unusable `highScores` were untested · **fixed**.
- `src/domain/save/save-store.ts` `[docs]` · `load()` JSDoc omitted the table · **fixed**.
- `docs/architecture/diagrams/meta/04-class-menus.md` `[docs]` · SaveStore bullet omitted the table · **fixed**.

## 🔵 Nice to Have

- `high-scores.test.ts` `[tests]` · the constant is pinned three ways; the `?? ''` hides a missing country.
- `high-scores.ts` `[docs]` · say the date is fixed on purpose; say the array is shared, never mutated.
- Smoke `fresh > empty * 2` is a weak proxy; content is pinned in unit tests (ADR-0026).

## ⚪ Disagree / Intentional

- A present but unusable `highScores` (`null`, a string) reads as a stored empty table, not the defaults: "kept as stored" (GDD §9.1, ADR-0021 allowlist).
- Saving an option on a fresh profile also writes the fictional rows (same as the first real entry).

## Per-dimension summary

- Design: ship as-is · Docs: two one-liners fixed · Tests: edge rows added · Security: no new input path, same allowlist parser · Correctness: a score ≤ 30 000 no longer reaches the name entry (designed, flagged to owner)
