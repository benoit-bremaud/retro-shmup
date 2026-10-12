# Local review — retro-shmup (branch `feat/level-tally`)

- Date: 2026-10-12
- Commit: the F-3 commits + the review fixes
- Scope: branch diff `origin/main...HEAD` — F-3, the end of brick F: `LevelTally` and
  `TallyTuning`, the tally added flat at `LEVEL_CLEARED`, `RunView.tally()`, the hud font's space
  glyph, the Results screen (header, five lines every 0.5 s, 1 s lock, 8 s exit), the doc pass
- Checks run: design · docs · tests · security · correctness
- Verdict: **ship** · Must 0 · Should 2 (fixed) · Nice 3 (2 fixed)

## 🔴 Must Have

_None._

## 🟡 Should Have

- `tests/domain/results.test.ts` `[tests]` · the 100 000 grouping case was not pinned · fixed.
- `tests/domain/score-keeper.test.ts` `[tests]` · nothing proved the tally is added exactly once
  and never multiplied · fixed: with a chain at ×3, `LEVEL_CLEARED` adds exactly 17 000 and leaves
  the multiplier unchanged.

## 🔵 Nice to Have

- Fixed: the `ScoreKeeper` TSDoc is rewrapped; an unreachable guard in `results.ts` reads
  `continue`.
- Left: two commits share a subject; the PR is squash-merged.

## ⚪ Disagree / Intentional

- The first tally line shows as Results starts, then one every 0.5 s (TOTAL at 2 s).
- Pause and Back are ignored during Results, which leads to the title in the one-level slice;
  recorded as an interim deviation in `05-state-scenes`.
- `LevelTally.reset()` waits for level 2's flow (brick G).

## Per-dimension summary

- Design: the tally is a subscriber owned by `ScoreKeeper`, read-only through `TallyView`.
- Docs: GDD §8 header sentence, diagrams, matrix, CHANGELOG, README and log match the code.
- Tests: 767 pass; checked in headless Chromium, landscape and portrait (total 11 000 added).
- Security: nothing untrusted introduced.
- Correctness: subscription order records the bombs left before the total; formatted once.
