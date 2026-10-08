# Local review — retro-shmup (branch `docs/uml-study`)

- Date: 2026-10-08
- Commit: `1606f26` + working tree (pre-push fixes)
- Scope: branch diff `main...HEAD` — the UML study for 1.0, ADR-0009 and ADR-0010, GDD v0.2 to
  v0.4, architecture and decision indexes, project log
- Checks run: docs · correctness (cross-diagram consistency) · security (hygiene). Design was
  reviewed block by block during the study (three blocks, two rounds each); tests: not applicable
  (no code).
- Verdict: **push** · Must 0 · Should 8 (7 fixed, 1 deferred) · Nice 11 (8 fixed, 3 accepted)

## 🔴 Must Have

_None._

## 🟡 Should Have

- `docs/architecture/traceability-matrix.md` `[docs]` · `WorldView` / `BulletSpawner` and the five
  adapters ticked in diagrams where they do not appear · fixed: rows split to the real diagrams.
- `docs/architecture/diagrams/gameplay/04-class-domain.md` `[docs]` · header and rule table cited
  GDD v0.3 while carrying v0.4 rules; no frame-tag titles on the two views · fixed.
- `02-sequence-player-hit.md` / `04-class-domain.md` `[correctness]` · `powerDropped` travelled
  through `DIED` while `HitOutcome` carries no data · fixed: `Run.playerDied()` calls
  `powerDown()` itself.
- `01-use-case.md` `[correctness]` · UC1 \*b ignored the remembered pause during cards and the
  count-in rule of GDD v0.4 §9.1 · fixed.
- `docs/architecture/README.md` `[docs]` · port ownership omitted ADR-0009 and ADR-0010 · fixed.
- `PROJECT_LOG.md` `[docs]` · the study entry names no PR or merge SHA · deferred: added when the
  PR is merged (per the project-log discipline).

## 🔵 Nice to Have

- Fixed: matrix wording (death release, `ScriptEvent`, `MessageCatalogue`); `Back` resumes in
  STM-scenes; GDD "Command pattern" wording; Activation row in the GDD Decision record;
  `BOMB_USED` row in the class rule table; `CLAUDE.md` link to the architecture overview.
- Accepted: block-time GDD versions cited in the UC and component headers (historical); four
  prose lines over 100 characters; ADR-0009's "leaving the pause is a menu choice" (the `Back`
  shortcut is the same choice, documented in STM-scenes).

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Design: reviewed during the study; nothing new in this pass.
- Docs: links all resolve; names consistent across ADRs and diagrams; matrix now exact.
- Tests: not applicable.
- Security: no secret, email or local path; Gitleaks clean; PlantUML SVGs in sync with sources.
- Correctness: one data-flow inconsistency (power drop) and one missing pause case, both fixed.
