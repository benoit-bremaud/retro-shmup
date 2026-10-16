# Local review — retro-shmup (level-1 filler rows, feat/levels-density)

- Date: 2026-10-16
- Commit: branch head (code PR of GDD v0.21 §7.2.3, design #94)
- Scope: branch diff main...HEAD — `src/domain/game/level-script.ts` (data rows + doc comment), `tests/domain/level-director.test.ts`, `tests/balance/level-1-balance.test.ts`, `tests/support/average-player.ts`, QA screenshots
- Checks run: design · docs · tests · security · correctness, read by hand: the diff is level data plus test pins, with no new type or logic in `src`
- Verdict: ship as-is · Must 0 · Should 0 · Nice 0

## Pre-merge gate
| Step | Result |
|---|---|
| 1 Tests | ✅ `make check`: unit + level simulation + balance guard, all green · ✅ `make smoke` 6/6 (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.27 % stmts / 95.67 % branches / 100 % funcs / 99.9 % lines (ratchet thresholds held) · docs 307/307 = 100 % |
| 3 SonarQube | run by the pre-push hook (`make verify`) |
| 4 Secrets | gitleaks on commit · no tracked `.env` besides `.env.example` · diff read: nothing sensitive |
| 5 QA pass | ✅ headless Chromium, build of the branch: title → play, 13 s and 23 s captures (the 22 s filler formation on screen), console clean · `docs/architecture/qa/2026-10-16-level-density-13s.png`, `-23s.png` |
- Gate: **GREEN** once CI passes

## 🔴 Must Have
_None._

## 🟡 Should Have
_None._

## 🔵 Nice to Have
_None._

## ⚪ Disagree / Intentional
- `tests/domain/level-director.test.ts` `GDD_ROWS` is a literal copy of the script order: it is the pin that makes any row edit a deliberate GDD change (as since v0.10).
- No UML change: data inside the existing `LevelScript` / `ScriptEvent` (GDD v0.21 PR #94).

## Per-dimension summary
- Design: data only, ADR-0003 untouched · Docs: script doc comment cites §7.2.3 · Tests: pins updated to GDD, new band `medianEmptyS ≤ 70` (measured 64.7 s) · Security: no input, no sink · Correctness: P curve unchanged (3 paying formations: 0, 32, 110 s), ceilings ≤ 16 / ≤ 40 held, WARNING field empty.
