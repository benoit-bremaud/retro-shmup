# Local review — retro-shmup (docs/rebalance-v018)

- Date: 2026-10-16
- Commit: see branch head
- Scope: branch diff origin/main...HEAD (docs only: GDD v0.18 values, UML value tables, traceability row)
- Checks run: docs · correctness (numbers) — design, tests, security not applicable (no code)
- Verdict: ship as-is after fixes · Must 0 (2 fixed) · Should 1 · Nice 1

## 🔴 Must Have

_None._ (Fixed: `04-class-domain.md` Heavy and Gunner rows gave the old values as current.)

## 🟡 Should Have

- `README.md:26-31` `[docs]` · states the v0.12 balance, correct for the code today · update in the tuning PR

## 🔵 Nice to Have

- `docs/design/game-design-document.md` decision record v0.6/v0.10 rows `[docs]` · tagged historical values, a "superseded by v0.18" pointer would help · optional

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary
- Design: n/a · Docs: consistent after fixes (arithmetic 18 000 × 66 % = 11 880, phase timings checked) · Tests: n/a (planned in the tuning PR) · Security: no secrets or sinks in docs · Correctness: numbers match the bot measurements
