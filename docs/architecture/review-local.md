# Local review — retro-shmup (branch `refactor/engine`)

- Date: 2026-10-12
- Commit: `2d24831`
- Scope: branch diff `main...HEAD` — trim of speculative seams found by the whole-repo audit
  (`World` no longer an `EnemySpawner`, `SceneMachine` takes `createRun`, `Run.publishAt` takes a
  `subject`, `Starfield` index loop); the class diagram now shows `Run` as the `EnemySpawner`
- Checks run: design · docs · tests · security · correctness
- Verdict: **ship** · Must 0 (2 found, both resolved in `2d24831`) · Should 2 · Nice 3

## 🔴 Must Have

_None open._ Two were found and resolved before the push:

- `src/domain/pool/fixed-pool.ts` `[design]` · removing `Pool<T>` drifted from ADR-0002, whose
  minimal interfaces are the contract for ADR-0003 · resolved: the interface is restored; its
  removal moves to the design ADR of brick F-0 (partial supersede of ADR-0002).
- `docs/architecture/diagrams/gameplay/04-class-domain.md:291` `[design][docs]` ·
  `EnemySpawner <|.. World` no longer matched the code · resolved: now `EnemySpawner <|.. Run`.
  The `Pool~T~` block and the traceability row stay valid with the restored interface.

## 🟡 Should Have

- `src/domain/game/run.ts:255` `[design]` · `publishAt` has six positional numeric parameters ·
  acceptable: private, allocation-free, replaces a third copy of the same code; a parameter object
  would allocate in the loop. Revisit when `RunRules` is extracted before the boss work.
- `docs/decisions/ADR-0002-…md:67` `[docs]` · `Pool<T>` stays the contract until the F-0 ADR
  retires it · action: fold the retirement into that ADR.

## 🔵 Nice to Have

- `CHANGELOG.md` `[docs]` · optional "Changed (internal)" entry; nothing player-visible changed.
- `src/domain/presentation/starfield.ts:32` `[correctness]` · the index loop only runs in the
  constructor; kept for consistency with the index-loop rule.
- Whole-repo audit follow-ups not in this diff (test parity of EN/FR keys, weak
  `toBeDefined()` assertions, TSDoc on `arbitration.ts` and the enemy archetypes, README ADR-0022
  entry) are tracked for a docs and tests pass.

## ⚪ Disagree / Intentional

- `src/domain/presentation/starfield.ts` `?? 0` · needed by `noUncheckedIndexedAccess` · no behaviour
  change.
- `World` is no longer an `EnemySpawner` · only `Run` is injected into the `LevelDirector`
  (`02-sequence-boss-fight.md:39`) · ADR-0022.

## Per-dimension summary

- Design: no regression in the code; the two Must were ADR and UML alignment, resolved.
- Docs: TSDoc accurate after the refactor; UML and traceability aligned.
- Tests: the single test change passes `createRun` explicitly; 541 tests pass, assertions untouched.
- Security: nothing relevant in the diff (no secrets, no untrusted input, no new sinks).
- Correctness: `publishAt` sets the same fields in the same order; the `Starfield` total and
  `FixedPool` are unchanged; every `SceneMachine` call site passes `createRun`.
