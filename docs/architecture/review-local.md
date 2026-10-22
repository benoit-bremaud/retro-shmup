# Local review — retro-shmup (feat/game-default-high-scores)

- Date: 2026-10-22
- Scope: branch diff origin/main...HEAD (default High scores table, #128, GDD v0.28)
- Checks run: design (architecture-guardian) · docs (doc-auditor) · tests (test-auditor) · security + correctness (read-only review)
- Verdict: ship — every Must and Should fixed · Must 0 open · Should 0 open · Nice 5 (below)

## Pre-merge gate

| Step | Result |
|---|---|
| 1 Tests | ✅ 1629 unit/integration (Vitest) · ✅ 6 smoke (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.24 % stmts / 95.7 % branches / 100 % funcs / 99.91 % lines (floor 80) · docs 99.5 % (floor 90) |
| 3 SonarQube | ✅ PASSED (make verify, before the fixes; re-run at the pre-push hook) |
| 4 Secrets | ✅ gitleaks clean · only `.env.example` tracked · diff read: nothing sensitive |
| 5 QA pass | ✅ full · console clean · screenshots: docs/architecture/qa/2026-10-19-flags-{country-choice,options,high-scores}.png |

- Gate: **GREEN** for the push; the merge gate re-runs on the merged SHA.

## 🔴 Must Have

- `src/domain/ports/render-port.ts` `[docs|design|security]` · `FLAG_SIZE` / `FLAG_GAP` split the `FontId` JSDoc from its type · **fixed**: constants moved below `FontId`.

## 🟡 Should Have

- `src/domain/presentation/overlays.ts` `[design]` · High scores flag 4 px after the code, 2 px elsewhere · **fixed**: `menuTextWidth(code) + FLAG_GAP` (x 120), `CODE_ADVANCE` removed, GDD/ADR/UML say x 120.
- `src/domain/presentation/overlays.ts` `[design]` · magic `-1` in `flagTop` · **fixed**: derived from the font and flag heights.
- `src/domain/scenes/country-choice.ts` `[design]` · `codeValid` duplicated `known` · **fixed**: one field.
- `src/adapters/flag-bank.ts` `[docs]` · `get` undocumented · **fixed**.
- GDD / ADR-0028 / CREDITS `[docs]` · "CC0" vs "public domain" · **fixed**: public domain everywhere; CREDITS pins commit a79ec57.
- `tests/adapters/canvas2d-renderer.test.ts` `[tests]` · helper orphaned a JSDoc · **fixed**.
- `tests/adapters/flag-bank.test.ts` `[tests]` · weak cell assertions, unused image id · **fixed**.
- `tests/domain/country-choice.test.ts` `[tests]` · tautological same-string test · **removed**.

## 🔵 Nice to Have

- `src/adapters/flag-bank.ts:6` `[design]` · `SHEET_COLUMNS` duplicates the script's `COLUMNS`; the script could write it into `flag-codes.ts`.
- `scripts/build-flag-sheet.py` `[security|design]` · parses `country-codes.ts` by text slicing, no usage check, Pillow not pinned; dev-only.
- `src/app/main.ts` `[correctness]` · the options code shifts 18 px left once when the sheet arrives after the first frames.
- `src/domain/presentation/overlays.ts` `[correctness]` · a 9-digit score would touch the flag (x 136 vs 138); level-1 scores stay far below.
- `tests/domain/overlays.test.ts` `[tests]` · layout numbers in the flag tests duplicate constants.

## ⚪ Disagree / Intentional

- `src/adapters/canvas2d-renderer.ts` `[design]` · default `new FlagBank()` in the constructor keeps the older call sites; an unbaked bank answers `false` as ADR-0028 decision 3 requires.

## Per-dimension summary

- Design: no over-engineering, rules held (no browser in domain, no per-frame allocation). · Docs: one displaced JSDoc fixed, 99.5 %. · Tests: unit-level, port-mocked, assertions tightened. · Security: no finding; allowlisted codes, same-origin asset. · Correctness: layout verified, gap unified to 2 px.
