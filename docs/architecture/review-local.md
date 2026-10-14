# Local review — retro-shmup (branch `docs/rebalance-v012`)

- Date: 2026-10-14
- Commit: cdd9ac4
- Scope: branch diff `origin/main...HEAD` — GDD v0.12, the second level-1 rebalance iteration
  (#45): Cruiser 14 500 tenths with phase 2 at 9 570, three formations (8 s, 50 s, 52 s) no
  longer pay the formation P; README, CHANGELOG, diagrams, matrix and log updated. Docs only.
- Checks run: design · docs · tests · security · correctness (one reconciled pass over an
  8-file docs diff; no sub-agents)
- Verdict: **ship** · Must 0 · Should 0 · Nice 1

## 🔴 Must Have

_None._

## 🟡 Should Have

_None._

## 🔵 Nice to Have

- `docs/design/game-design-document.md` §Decision record `[docs]` · the v0.12 row is long (the
  measurement table and the rejected alternatives share two cells); acceptable for a record, but a
  link to the study report would shorten it once the reports are kept in the repo.

## ⚪ Disagree / Intentional

- `docs/architecture/diagrams/gameplay/04-class-domain.md` `[design]` · `paysP` is a suggested
  name for the follow-up code PR; the GDD calls it the *pays P* property, default true.
- `docs/design/game-design-document.md` §7.2.2 `[design]` · a formation without P still scores
  and still counts in the end-of-level tally; only the P spawn is skipped (sequence diagram 02
  updated). Design call to confirm in the playtest.

## Per-dimension summary

- Design: values and rules changed in the GDD first (design before code); no code touched.
- Docs: no stale 5 000 / 3 300 / "500 shots" left outside the v0.10/v0.11 history rows and
  unrelated tally figures; every number matches the study reports.
- Tests: none touched; the 21 assertions the tuning PR must re-derive are listed in the log.
- Security: nothing untrusted introduced.
- Correctness: figures checked against the measurement reports (14 000 row: average-bot deaths
  1.12, dodger 100 % game over; fight 42 / 42 / 44 s at 14 500).
