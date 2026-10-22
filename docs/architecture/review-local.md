# Local review — retro-shmup (branch chore/sonar-gate, #134)

- Date: 2026-10-22
- Scope: branch diff origin/main...HEAD (`sonar-project.properties`, `tests/smoke/first-playable.spec.ts`)
- Checks run: design · docs · tests · security · correctness (read by hand, two files) and the execution checks
- Verdict: ship · Must 0 · Should 0 · Nice 1

## Pre-merge gate (execution checks)
| Step | Result |
|---|---|
| 1 Tests | ✅ 1 651 unit/simulation · ✅ smoke 6/6 (Chromium, Firefox, WebKit), three runs in a row |
| 2 Coverage | 99.24 % stmts / 95.7 % branches / 100 % funcs / 99.91 % lines |
| 3 SonarQube | ✅ PASSED (failed before: 12 new violations from the 26.10 rules S2925 and S9382) |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive |
| 5 QA pass | smoke suite only (no runtime code changed) |

## 🔴 Must Have
_None._

## 🟡 Should Have
_None._

## 🔵 Nice to Have
- `sonar-project.properties` `[ci]` · the new-code period (PREVIOUS_VERSION since 2026-10-08, no `sonar.projectVersion`) makes any new profile rule block the whole repository · separate follow-up.

## ⚪ Disagree / Intentional
- `tests/smoke/**` S2925, `src/adapters/web-audio-player.ts` S9382 `[tests]` · waits on the game's own time rules and a sequential decode on purpose · scoped, commented exclusions e4/e5, as e1–e3.

## Per-dimension summary
- Design: none. Docs: exclusions commented. Tests: two fixed waits now poll the pause state. Security: none. Correctness: the smoke assertions are unchanged in meaning.
