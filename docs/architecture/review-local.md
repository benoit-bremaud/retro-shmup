# Local review — retro-shmup (feat/ui-tap-targets: #95)

- Date: 2026-10-16
- Commit: 3dd28ed
- Scope: branch diff origin/main...HEAD
- Checks run: design · docs · tests · security · correctness
- Verdict: ship — Must 0 · Should 0 open (4 fixed) · Nice 2 open

## Pre-merge gate (head SHA 3dd28ed)

| Step | Result |
|---|---|
| 1 Tests | ✅ 1480 unit / scene-machine / simulation · ✅ 6 smoke (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.27 % stmts / 95.63 % branches / 100 % funcs / 99.91 % lines (floor 80) · docs 100 % (342/342, floor 90) |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean (pushed range) · only `.env.example` tracked · diff read: nothing sensitive |
| 5 QA pass | ✅ full · 390 × 844: title → Options → Visual effects by taps, 32 px rows = 48 CSS px at ×3 · console: favicon 404 only (pre-existing) · screenshots: `docs/architecture/qa/2026-10-16-tap-targets-{title,options,effects}.png` |

- Gate: **GREEN — merge authorised**

## 🔴 Must Have

_None._

## 🟡 Should Have

- ~~`src/domain/scenes/scene-machine.ts:275` `[design]` · header gap and header font declared apart~~ — fixed: `headerGap` exposed on `OpenableMenu`, a scene-machine test checks it against every screen's header font.
- ~~`scene-machine.ts`, `controls-grid.ts:60` `[design]` · `undefined` passed to reach the third argument~~ — fixed: `Menu(rows, { flips, headerGap })`.
- ~~`tests/domain/scene-machine.test.ts:928` `[tests]` · `rowTap` silently assumes 32 px rows~~ — fixed: it throws otherwise.
- ~~`src/domain/scenes/menu.ts:24` `[docs]` · `rowHeight` undocumented~~ — fixed.

## 🔵 Nice to Have

- `src/domain/presentation/menu-layout.ts:6` `[design]` · `MENU_ROW_HEIGHT` is both the minimum row and the fixed line of the high scores / name entry; a `MENU_LINE_HEIGHT` split would read clearer.
- `src/domain/presentation/menu-layout.ts` `[correctness]` · `menuTop` returns a half pixel for an odd `rows × rowHeight` total; no current menu does (2, 3, 6, 7, 9, 10 rows).

## ⚪ Disagree / Intentional

- `src/domain/scenes/menu.ts:4` `[design]` · the scene imports presentation layout: both are domain, pre-existing.
- `tests/domain/scene-machine.test.ts` `[tests]` · bracket access to the private `menuScreens`: the invariant spans the private table; documented with its eslint exception.

## Per-dimension summary

- Design: proportionate, one pure function; drift risk closed by a test · Docs: 100 %, GDD v0.25 + UML aligned · Tests: rule, layout, scene-machine and smoke covered · Security: no finding · Correctness: formula matches the GDD, every gap matches its header.
