# Local review — retro-shmup (design PR, GDD v0.26)

- Date: 2026-10-19
- Commit: 3d5e5ab
- Scope: branch diff origin/main...HEAD (docs only: GDD v0.26, ADR-0027, UML, README privacy)
- Checks run: design/consistency · docs · security/privacy (one Opus reviewer, docs-only diff) · execution checks
- Verdict: ship — Must 5 → 0 · Should 8 → 0 · Nice 4 (2 applied, 2 no change)

## Pre-merge gate (head SHA 3d5e5ab)
| Step | Result |
|---|---|
| 1 Tests | ✅ 1480 unit/integration (make verify); smoke not run (docs-only diff, no runtime change) |
| 2 Coverage | tests 99.27 % stmts / 95.63 % branches / 100 % funcs / 99.91 % lines · docs unchanged (no code) |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: no address, no token |
| 5 QA pass | n/a — docs-only diff |
- Gate: **GREEN for a docs PR**

## 🔴 Must Have
_None open._ Fixed in 3d5e5ab: G2 state diagram and old GDD country-step text marked superseded; title rows list updated; blocked-tab detection decided (no `noopener`, `opener = null`, `null` = refused); README privacy section added.

## 🟡 Should Have
_None open._ Fixed: §9.3 texts, ADR-0006/0021 status lines, opening inside the input handler, privacy (no personal data line, retention, age band held back), forged hidden fields noted, country-choice opening guard and cursor, gamepad path drawn, free-height defined.

## 🔵 Nice to Have
- Applied: sequence `back` branch; `country=none` vs empty; version pinned to `MAJOR.MINOR.PATCH`.
- No change: two states sharing the label "Country choice" is valid Mermaid.

## ⚪ Disagree / Intentional
_None._

## Per-dimension summary
- Design: consistent after fixes · Docs: indexes and statuses updated · Tests: n/a · Security: allowlisted params, build-checked https base URL, no PII · Correctness: geometry 104 + 6 × 32 = 296 ≤ 320
