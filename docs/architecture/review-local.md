# Local review — retro-shmup (branch `refactor/engine`)

- Date: 2026-10-15
- Commit: see the branch tip
- Scope: branch diff `origin/main...HEAD` — `src/domain/scenes/scene-machine.ts` (the dispatch
  table and the single scene timer designed in #72), the *planned* tags lifted in CD-menus,
  STM-scenes and the matrix, the `PROJECT_LOG.md` entry.
- Checks run: design · correctness (architecture-guardian, step-for-step timer equivalence) ·
  docs (UML against the code, comments on the new members) · tests (suite unchanged; SonarQube
  new-code gate) · security (no input, storage or DOM surface touched)
- Verdict: **ship** · Must 0 · Should 0 · Nice 2 (both applied)

## 🔴 Must Have

_None._

## 🟡 Should Have

_None._

## 🔵 Nice to Have

- `src/domain/scenes/scene-machine.ts` `[design]` · four closure factories for the routed
  Title / Pause steps · applied: the steps take their scene first and are bound with
  `bind(this, scene)`, as CD-menus describes.
- `docs/architecture/diagrams/meta/05-state-scenes.md` `[docs]` · "share one handler" · applied in
  #72: "share one step method".

## ⚪ Disagree / Intentional

- `src/domain/scenes/scene-machine.ts` `[design]` · a bound-method table rather than per-scene
  State objects · owner decision (option B, 2026-10-15, CD-menus note).
- `src/domain/scenes/scene-machine.ts` `[design]` · unused `_dt` on the frame-only steps · the
  shared `SceneStep` signature.
- `src/domain/scenes/scene-machine.ts` `[design]` · the file grows from 672 to about 730 lines ·
  the gain is one compiler-checked extension point and one timer, not fewer lines.

## Per-dimension summary

- Design: no anti-pattern, no over-engineering; ADR-0003 respected; matches CD-menus and
  STM-scenes.
- Docs: the *planned* tags of #72 lifted with the code, so the UML and the code agree.
- Tests: `tests/` untouched; 1190 tests passing; the SonarQube quality gate passed.
- Security: no surface changed; gitleaks and `pnpm audit` clean.
- Correctness: count-in, game over, Results and Ending timers equivalent step for step; every
  scene change goes through `enter()`; the handlers are built once, so a step allocates nothing.
