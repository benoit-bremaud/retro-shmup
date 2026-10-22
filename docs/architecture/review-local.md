# Local review — retro-shmup (branch docs/death-resets-weapon, design PR #130)

- Date: 2026-10-22
- Scope: branch diff origin/main...HEAD, docs-only (GDD v0.29, UML, traceability, CHANGELOG, PROJECT_LOG); no code, no ADR edited
- Checks run: cross-document consistency grep (design, docs, correctness), prettier, gitleaks; agents and the pre-merge execution steps are proportionate to a docs-only diff and are run on the merged SHA before merge
- Verdict: ship (push) · Must 0 · Should 1 · Nice 0

## 🔴 Must Have
_None._

## 🟡 Should Have
- `docs/architecture/diagrams/system/01-use-case.md:77` `[docs]` · UC step 5c still described the one-level penalty and the release · fixed in this branch (now the reset to the Spread at level 1, no release).

## 🔵 Nice to Have
_None._

## ⚪ Disagree / Intentional
- `docs/decisions/ADR-0019-*.md:53,67`, `ADR-0010-*.md:45` `[docs]` · still name `powerDown` and the release hop · ADR text is not edited outside a dedicated PR (CLAUDE.md); the GDD decision record row v0.29 supersedes them; logged in PROJECT_LOG.

## Per-dimension summary
- Design: the 4 owner decisions (MCDA 395 / 445 / 430 / 445) are in the decision record. Docs: prettier clean. Security: no code, gitleaks clean. Tests: none touched; code PR carries them. Correctness: sequence diagram `end` balance checked.
