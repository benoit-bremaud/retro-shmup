# Local review — retro-shmup (branch `docs/uml`)

- Date: 2026-10-15
- Commit: see the branch tip
- Scope: branch diff `main...docs/uml` — the UML of the planned scene machine refactor
  (CD-menus `SceneHandler`, `handlers`, `sceneSteps`; STM-scenes implementation-shape note;
  one traceability row). Docs only; the code follows in its own `refactor/engine` PR, which
  records its own review.
- Checks run: docs (doc-auditor) · design (architecture-guardian, UML against the owner-approved
  option B and ADR-0003). Tests, security and correctness: not applicable, no code or test changed.
- Verdict: ship after the fixes below (applied) · Must 1 · Should 3 · Nice 2

## 🔴 Must Have

- `docs/architecture/diagrams/meta/04-class-menus.md`, `05-state-scenes.md` `[docs]` · the refactor
  read as already built while the code still has the `switch` and four timers · applied: the new
  fields, the edge and both notes are tagged *planned refactor*, as `idleSteps` already is.

## 🟡 Should Have

- `docs/architecture/diagrams/meta/04-class-menus.md` `[docs]` · `SceneHandler.step(dt, frame)`
  has no scene, while the routed Title / Pause steps need one · applied: the note says those steps
  take their scene first and get it bound with `bind(this, scene)`.
- `docs/architecture/diagrams/meta/04-class-menus.md` `[docs|design]` · `*--` composition drew
  owned functions as parts · applied: a `..>` dependency labelled *handlers table, one entry per Scene*.
- `docs/architecture/traceability-matrix.md` `[docs]` · "unchanged" claimed an outcome before the
  code exists · applied: "must pass unchanged", row tagged planned.

## 🔵 Nice to Have

- `docs/architecture/diagrams/meta/04-class-menus.md` `[docs]` · "the count-in digit is derived"
  was vague · applied: the drawing gets `COUNT_IN_STEPS - sceneSteps`.
- `docs/architecture/diagrams/meta/04-class-menus.md` `[docs]` · the rejected-options sentence is
  long · kept: it is the decision record.

## ⚪ Disagree / Intentional

- `docs/architecture/diagrams/meta/04-class-menus.md` `[design]` · a bound-method table rather
  than per-scene State objects · owner decision (option B, 2026-10-15); ADR-0003 allows both.

## Per-dimension summary

- Design: matches option B and ADR-0003 · Docs: planned status now explicit, Mermaid follows the
  file's existing syntax · Tests: n/a (no test changed) · Security: n/a (docs only) · Correctness:
  n/a (no code)
