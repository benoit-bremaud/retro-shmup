# Local review — retro-shmup (branch feat/ui-country-first vs origin/main)

- Date: 2026-10-19
- Commit: 220f1eb
- Scope: branch diff origin/main...HEAD (country first, #115 letter grid)
- Checks run: design · docs · tests · security · correctness
- Verdict: ship as-is · Must 0 · Should 0 open (4 fixed) · Nice 3 open

## Pre-merge gate (head SHA 220f1eb)
| Step | Result |
|---|---|
| 1 Tests | ✅ 1500 unit/scene · ✅ 6 smoke (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.3 % stmts / 95.7 % branches / 100 % funcs / 99.9 % lines (floor 80) · docs 100 % (floor 90) |
| 3 SonarQube | ✅ PASSED (one redundant type alias fixed first) |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive |
| 5 QA pass | ✅ full · console clean · screenshots: docs/architecture/qa/2026-10-19-country-mobile.png, docs/architecture/qa/2026-10-19-country-desktop.png |
- Gate: **GREEN — merge authorised** (after owner approval)

## 🔴 Must Have
_None._

## 🟡 Should Have (fixed)
- `src/domain/scenes/scene-machine.ts` `[design|correctness]` · left/right on the Country row opened the screen · `hasValue` excludes `country`, test added.
- `tests/domain/scene-machine.test.ts` `[tests]` · PauseCountry, NONE at start, back from options untested · four tests added.
- `src/domain/scenes/country-choice.ts` `[design]` · sibling scene imported the country cells from name-entry · grid helpers moved to `letter-grid.ts`, cells to `country-choice.ts`.
- `src/domain/options.ts` `[design]` · type alias named like the scene class · removed, plain `string`.

## 🔵 Nice to Have
- `src/domain/options.ts` `[design]` · precompute the code values map instead of the lazy cache.
- `src/domain/scenes/scene-machine.ts` `[design]` · narrow `openCountry`'s scene parameter.
- `src/domain/presentation/overlays.ts` `[docs]` · name the 1 px highlight gap.

## ⚪ Disagree / Intentional
- Three country scenes (Start, Title, Pause) · follows the existing Title*/Pause* routes.
- Code and `--` drawn outside the catalogue · GDD v0.26 §9.3, not translatable text.

## Per-dimension summary
- Design: clean after the module move · Docs: UML 04 updated, 100 % · Tests: country flows covered · Security: parseCountry allowlisted, never throws · Correctness: flows match GDD v0.26 and meta/05.
