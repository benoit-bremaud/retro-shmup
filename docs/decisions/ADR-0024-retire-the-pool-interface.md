# ADR-0024: Retire the `Pool<T>` interface — `FixedPool<T>` is the pool contract

**Status:** Accepted — 2026-10-13. **Partially supersedes ADR-0002**: the `Pool<T>` line of its
"Minimal interfaces" block. Every other part of ADR-0002 stands, the object pools and the
no-allocation rule included.

## Context

- ADR-0002 lists `export interface Pool<T> { acquire; release; size }` among the minimal
  interfaces whose names are the contract for ADR-0003.
- The code has exactly one pool, `FixedPool<T>` (`src/domain/pool/fixed-pool.ts`), filled once at
  construction and failing closed on a double release. `ActiveList<T>`, the only client, is typed
  against `FixedPool<T>`, not `Pool<T>`; nothing else implements or consumes the interface, and
  `size` has no caller in `src/`.
- The whole-repo audit of 2026-10-12 flagged the interface as speculative generality (YAGNI). It
  was kept then because removing it would have drifted from ADR-0002 silently; the owner chose to
  retire it through its own ADR. The over-engineering audit of 2026-10-13 flagged it again, with
  three other leftovers that need no ADR (`Body.volleys[1]`, `RunConfig.script`,
  `LevelTally.reset()`).
- An interface over a single class is not a seam: no test double, no second implementation and no
  module boundary uses it.

## Decision

1. **`FixedPool<T>` is the pool contract.** The `Pool<T>` interface is deleted; `FixedPool<T>` keeps
   its behaviour (fill once, `acquire` returns `undefined` when exhausted, `release` throws on a
   double or foreign release). Its `size` member stays only if a test or a client still needs it.
2. **An interface returns only with a second implementation** (for example a growable pool for
   a tool, or a test double that cannot be a `FixedPool`), in the same change that introduces it.
3. **Names.** The class diagram shows `FixedPool~T~` where it showed `Pool~T~`; the «pooled»
   stereotype means "from a `FixedPool<T>`".

## Alternatives considered

- **Keep `Pool<T>`** (the status quo) — rejected: an abstraction with one implementation and no
  client costs reading time and invites indirection that buys nothing (KISS, YAGNI).
- **Remove it without an ADR** — rejected: ADR-0002 names it as a contract; the project never
  reopens a validated decision silently (CLAUDE.md).

## Consequences

- Positive: one fewer type; the pool code reads as what it is.
- Negative: none at runtime; a future second pool implementation brings its interface back.
- Code review checks: no new interface over a single implementation without a second client.
- Tests: `FixedPool`'s tests are unchanged; the refactor PR keeps all tests green as its oracle.

## References

- ADR-0002, ADR-0003; `docs/architecture/diagrams/gameplay/04-class-domain.md`;
  `docs/architecture/review-local.md` and the 2026-10-12 / 2026-10-13 audits in `PROJECT_LOG.md`.
- Michael Nygard, "Documenting Architecture Decisions":
  https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
