# Local review — retro-shmup (branch `refactor/leftovers`)

- Date: 2026-10-14
- Commit: fde5162
- Scope: branch diff `origin/main...HEAD` — behaviour-preserving removal of the over-engineering
  leftovers: `Pool<T>` and `FixedPool.size` (ADR-0024), `RunConfig.script`, `LevelTally.reset()`,
  the second slot of `Body.volleys`, the copy in `sequenceAttack`
- Checks run: design · docs · tests · security · correctness (one reconciled pass over a small
  diff: 23 files, +123 / −145; no sub-agents)
- Verdict: **ship** · Must 0 · Should 0 · Nice 1

## 🔴 Must Have

_None._

## 🟡 Should Have

_None._

## 🔵 Nice to Have

- `docs/architecture/review-local.md` `[docs]` · the previous report (F-3) is replaced by this
  one; history keeps it in git.

## ⚪ Disagree / Intentional

- `docs/architecture/diagrams/gameplay/04-class-domain.md` (~l.561) `[docs]` · still says
  `LevelTally` is "reset at each level": it describes the planned level-2 flow (`startNextLevel`,
  brick G), not shipped code; `reset()` returns with that flow.
- `src/domain/game/attacks.ts:183` `[design]` · `sequenceAttack` no longer copies its groups:
  `readonly` types block mutation and the only caller (`cruiser.ts`) passes load-time literals.

## Per-dimension summary

- Design: dead abstractions removed, no new structure; ADR-0024 realised.
- Docs: TSDoc, class diagram, CHANGELOG and PROJECT_LOG match the code; no stale `volleys[0]`,
  `Pool<T>` or `script:` left in src, tests or non-ADR docs.
- Tests: 863 pass; only tests of removed API deleted (`size`, `reset`), call sites migrated
  (`script: X` → `levels: [X]`), no expectation changed to pass.
- Security: nothing untrusted touched.
- Correctness: `volleys` reset on spawn and on phase restart is preserved; no allocation added.
