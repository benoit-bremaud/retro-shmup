# Local review — retro-shmup (refactor/engine)

- Date: 2026-10-15
- Commit: cb9818a
- Scope: branch diff main...refactor/engine (docs/uml + refactor/engine, scene machine dispatch table)
- Checks run: design · correctness (architecture-guardian, step-for-step timer equivalence); docs, tests, security judged not applicable — pure refactor, tests untouched, no input/storage/DOM surface changed
- Verdict: ship as-is · Must 0 · Should 0 · Nice 2 (both applied)

## 🔴 Must Have
_None._

## 🟡 Should Have
_None._

## 🔵 Nice to Have
- `src/domain/scenes/scene-machine.ts` `[design]` · four closure factories for the Title / Pause routed steps · applied: `scene` first, `bind(this, scene)`
- `docs/architecture/diagrams/meta/05-state-scenes.md` `[docs]` · "share one handler" inaccurate · applied: "share one step method"

## ⚪ Disagree / Intentional
- `src/domain/scenes/scene-machine.ts` `[design]` · bound-method table rather than per-scene State objects · owner decision (option B, 2026-10-15, CD-menus note)
- `src/domain/scenes/scene-machine.ts` `[design]` · unused `_dt` on frame-only steps · shared `SceneStep` signature

## Per-dimension summary
- Design: no anti-pattern, no over-engineering; ADR-0003 respected · Docs: UML matches the code · Tests: suite unchanged, 1190 passing · Security: no surface changed · Correctness: the four timers and every reset are equivalent; no allocation per step
