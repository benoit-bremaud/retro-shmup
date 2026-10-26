# Local review — retro-shmup (docs/design, #131)

- Date: 2026-10-26
- Commit: 113bc61 (+ review fixes)
- Scope: branch diff origin/main...HEAD — docs only (GDD v0.30, ADR-0021 amendment, ADR-0009,
  UML meta and use-case, traceability matrix)
- Checks run: docs · correctness (design, tests, security agents not applicable: no code changed)
- Verdict: ship as-is · Must 0 · Should 3 (fixed) · Nice 2

## Pre-merge gate (head SHA 113bc61)

| Step | Result |
|---|---|
| 1 Tests | ✅ 1 648 unit/simulation tests (77 files) · smoke not run (docs diff, `--push` mode) |
| 2 Coverage | tests 99.24 % stmts / 95.68 % branches / 100 % funcs / 99.91 % lines (floor 80) · docs 99.5 % (floor 90) |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean (pushed range) · no tracked .env · diff read: nothing sensitive |
| 5 QA pass | ⚠️ not run (`--push` mode; docs-only diff, no runtime change) |

- Gate: **GREEN for push**; QA smoke before merge.

## 🔴 Must Have

_None._

## 🟡 Should Have

- `docs/design/game-design-document.md:891` `[docs]` · superseded UC3 country step still named the
  language only · fixed: *v0.30: the browser time zone first* note.
- `docs/design/game-design-document.md:915` `[docs]` · same · fixed.
- `docs/architecture/diagrams/system/01-use-case.md:91` `[docs]` · UC step said "browser language"
  · fixed: time zone, else the language's region.

## 🔵 Nice to Have

- `src/domain/scenes/scene-host.ts:27` `[docs]` · code still names `countryOfLanguage` · intended:
  the rename is tagged *planned* in `04-class-menus.md`, done in the code PR.
- `CHANGELOG.md` `[docs]` · add the Unreleased entry with the code PR.

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Docs: consistent across GDD, ADRs, UML, matrix after the three fixes; IANA claims verified.
- Correctness: no contradiction with ADR-0021 decisions 1–3 or ADR-0009.
- Design · Tests · Security: not applicable (no code).
