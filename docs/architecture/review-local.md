# Local review — retro-shmup (#147 design)

Local gate on the design-only PR for #147: GDD v0.32 and UML for the chain labels.

- Date: 2026-10-28
- Scope: branch diff `main...HEAD` (`docs/147-chain-hint-design`), docs only
- Checks run: docs (doc-auditor, consistency with `src/domain/options.ts` and the fonts) · secrets
- Verdict: ship · Must 0 · Should 2 (fixed) · Nice 3 (1 fixed, 2 for the code PR)

## Pre-merge gate

| Step | Result |
|---|---|
| 1 Tests | n/a — no code changed |
| 2 Coverage | n/a — no code changed |
| 3 SonarQube | n/a — no code changed |
| 4 Secrets | ✅ gitleaks clean (`main..HEAD`) · only `.env.example` tracked · diff read: nothing sensitive |
| 5 QA pass | n/a — docs diff, nothing runs differently |

- Gate: **GREEN** for a docs-only design PR

## 🔴 Must Have

_None._

## 🟡 Should Have

- `docs/design/game-design-document.md:1093` `[docs]` · *Visual effects* row height still read 26 px / 11 rows · fixed: 24 px at 12 rows
- `docs/architecture/diagrams/meta/04-class-menus.md:354` `[docs]` · "six switches today" was stale · fixed: nine with `chainHints`

## 🔵 Nice to Have

- `docs/design/game-design-document.md:816` `[docs]` · y 40 coordinate space unstated · fixed: play-field pixels
- `src/domain/ports/render-port.ts:29` `[docs]` · `FontId` comment must mention `×` in `menu` · code PR
- `docs/architecture/diagrams/gameplay/02-sequence-enemy-destroyed.md:150` `[docs]` · "step 7" matches `ScoreKeeper`'s doc comment (tick at step 7) · verified

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Design: n/a · Docs: consistent after fixes · Tests: planned in the traceability matrix · Security: no surface · Correctness: row count and text widths verified
