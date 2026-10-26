# Local review — retro-shmup (feat/game, #131)

- Date: 2026-10-26
- Commit: 6de0359
- Scope: branch diff origin/main...HEAD — country preselected from the browser time zone
- Checks run: design · docs · tests · security · correctness (architecture-guardian, own reading)
- Verdict: ship as-is · Must 0 · Should 1 (fixed) · Nice 3 (2 fixed)

## Pre-merge gate (head SHA b42dfd9, re-run by the pre-push hook on 6de0359)

| Step | Result |
|---|---|
| 1 Tests | ✅ 1 660 unit/simulation tests · ✅ smoke 6/6 (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.24 % stmts / 95.6 % branches / 100 % funcs / 99.91 % lines (floor 80) · docs 99.5 % (floor 90) |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive (IANA public data) |
| 5 QA pass | ✅ smoke in three engines; the preselection runs once at startup (no visible change for a matching language) |

- Gate: **GREEN**.

## 🔴 Must Have

_None._

## 🟡 Should Have

- `scripts/build-time-zone-table.py:33` `[correctness]` · generic zones (`CET`, `EST5EDT`, `MST`…)
  inherited a city's country since tzdata 2024b · fixed: link names without a slash are skipped;
  `CET` and `EST5EDT` added to the fall-through test.

## 🔵 Nice to Have

- `scripts/build-time-zone-table.py:16` `[correctness]` · code list parsing anchored on `'AD` · fixed.
- `src/domain/scenes/scene-machine.ts:657` `[docs]` · stale comment · fixed.
- `tests/domain/preselection.test.ts` `[tests]` · no check that the committed table matches the
  script output · left: the script needs the host's tzdata, the table is refreshed with releases.

## ⚪ Disagree / Intentional

- `src/app/main.ts` `[design]` · the composition root calls the pure domain function once at
  startup · ADR-0009 decision 4 (startup snapshot).

## Per-dimension summary

- Design: domain free of browser APIs, no loop allocation, named exports. · Docs: UML tag lifted,
  CHANGELOG and PROJECT_LOG entries. · Tests: 8 cases on the pure function, table validated
  against `COUNTRY_CODES`. · Security: the untrusted zone name is only a `Map` key. ·
  Correctness: generic zones fixed.
