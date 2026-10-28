# Local review — retro-shmup (feat/game, #131)

- Date: 2026-10-26
- Commit: 975025a
- Scope: branch diff origin/main...HEAD — country preselected from the browser time zone
- Checks run: design · docs · tests · security · correctness (architecture-guardian, test-auditor,
  security review on Opus, own reading)
- Verdict: ship as-is · Must 1 (fixed) · Should 4 (fixed) · Nice 5 (4 fixed)

## Pre-merge gate (head SHA 87fc35c; tests and SonarQube re-run on 975025a)

| Step | Result |
|---|---|
| 1 Tests | ✅ 1 664 unit/simulation tests · ✅ smoke 6/6 (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.24 % stmts / 95.6 % branches / 100 % funcs / 99.91 % lines (floor 80) · docs 99.5 % (floor 90) |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive (IANA public data) |
| 5 QA pass | ✅ smoke in three engines · preview captures `qa/2026-10-26-country-preselect-{fr,utc}.png` (en-US + Europe/Paris → FR, en-US + UTC → US) |

- Gate: **GREEN**.

## 🔴 Must Have

- `tests/domain/preselection.test.ts` `[tests]` · the table test checked only the codes, one
  `expect` per pair · fixed: zone names must contain `/`, bad pairs collected into one assertion.

## 🟡 Should Have

- `scripts/build-time-zone-table.py:33` `[correctness]` · generic zones (`CET`, `EST5EDT`, `MST`…)
  inherited a city's country since tzdata 2024b · fixed: link names without a slash are skipped;
  `CET` added to the fall-through test.
- `tests/domain/preselection.test.ts` `[tests]` · missing cases (multi-zone country, link-only
  names, zone wins over an unknown or lowercase region), redundant fall-through cases · fixed.
- `src/domain/hall-of-fame/preselection.ts:21` `[security]` · zone codes not re-checked against
  `COUNTRY_CODES` · covered by the table test (every code must be in the allowlist).

## 🔵 Nice to Have

- `scripts/build-time-zone-table.py:16` `[correctness]` · code list parsing anchored on `'AD` · fixed.
- `src/domain/scenes/scene-machine.ts:657` `[docs]` · stale comment · fixed.
- `scripts/build-time-zone-table.py:19` `[security]` · fails loudly when the code list cannot be
  read; docstring names the tzdata source · fixed.
- `tests/domain/preselection.test.ts` `[tests]` · no check that the committed table matches the
  script output · left: the script needs the host's tzdata, the table is refreshed with releases.

## ⚪ Disagree / Intentional

- `src/app/main.ts` `[design]` · the composition root calls the pure domain function once at
  startup · ADR-0009 decision 4 (startup snapshot).

## Per-dimension summary

- Design: domain free of browser APIs, no loop allocation, named exports. · Docs: UML tag lifted,
  CHANGELOG and PROJECT_LOG entries. · Tests: 16 cases on the pure function, table validated
  against `COUNTRY_CODES`. · Security: the untrusted zone name is only a `Map` key. ·
  Correctness: generic zones fixed.
