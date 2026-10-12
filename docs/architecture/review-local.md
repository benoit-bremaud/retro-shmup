# Local review — retro-shmup (branch `feat/level-heavy`)

- Date: 2026-10-12
- Commit: `eb0bd4c` + the Should fixes of this review
- Scope: branch diff `origin/main...HEAD` — F-1 of the level brick: strategy factories, the Heavy
  (ring and fan), the 120 s level-1 script, `Body.volleys`
- Checks run: design · docs · tests · security · correctness
- Verdict: **ship** · Must 0 · Should 4 groups (all fixed) · Nice 5

## 🔴 Must Have

_None._

## 🟡 Should Have

- `tests/domain/heavy.test.ts` `[tests]` · the ring-rotation test compared `angle % 30`, which
  breaks around 0° (359.9999° gives 29.9999) · fixed: the orientation is the distance to the
  nearest multiple of 30°.
- `tests/domain/heavy.test.ts`, `tests/domain/pickups.test.ts` `[tests]` · the Heavy's death path
  (1 000 points, Large tier, Bomb or Shield at 60 %, nothing at 60 % or more) and a fan aimed at an
  off-axis ship were untested · fixed: tests added.
- `tests/domain/level-simulation.test.ts` `[tests][correctness]` · only a peak of 40 enemy bullets
  was asserted against a pool of 48 · fixed: a dedicated 102–116 s window test pins the real peak
  (30 observed, between 24 and 36 allowed, the pair of a ring and a fan overlapping); the string
  keys `'heavy-ring:undefined'` are replaced by two sets.
- `docs/architecture/diagrams/meta/05-state-scenes.md` `[docs]` · "lifted by the level brick" and
  "wait for the Heavy" were stale · fixed.
- Also fixed from the first design pass: a stacked JSDoc in `tuning.ts`, and `aimedAttack` now
  counts its volleys like every pattern (ADR-0022 §2), with a test.

## 🔵 Nice to Have

- `StrategyFactories` of the class diagram shows positional parameters; the code takes one config
  object.
- `Body.volleys[1]` is not used yet (reserved by ADR-0022 for `parallelAttack`); `volleys[0]` is
  unbounded (about 6 per Heavy).
- A test of the shared bullet-pool margin for the Cruiser boss belongs to F-2.

## ⚪ Disagree / Intentional

- `tests/domain/heavy.test.ts` "is a frozen object built once" · the reviewer called it a test of
  `Object.freeze`, but ADR-0022 requires the shared strategies to be immutable · kept.
- Old role names in the class diagram and traceability matrix name the strategy roles, not the
  exported symbols · ADR-0022.

## Per-dimension summary

- Design: numbers and strategies conform to GDD v0.10 and ADR-0022; no allocation in the loop, no
  nondeterminism, no new player-facing string.
- Docs: TSDoc complete on the new surface; README, CHANGELOG and PROJECT_LOG match the code.
- Tests: no false confidence, nothing from the domain mocked; the death path and the bullet-pool
  margin are now pinned (579 tests).
- Security: nothing untrusted introduced.
- Correctness: 36 script rows match the GDD, angle signs are right, volley counters reset on
  spawn, no NaN when the ship is on the Heavy.
