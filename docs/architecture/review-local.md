# Local review — retro-shmup (feat/champion-name)

- Date: 2026-10-16
- Commit: see the PR head
- Scope: branch diff origin/main...HEAD (GDD v0.22 §9.4.1 code; `ChampionName`, `Starfield.drawLayers`, `far` font, `championName` switch)
- Checks run: design (architecture-guardian) · docs · tests · security · correctness
- Verdict: ship · Must 0 · Should 0 open (4 fixed) · Nice 3 deferred

## Pre-merge gate
| Step | Result |
|---|---|
| 1 Tests | ✅ 1 323 unit / simulation / balance · ✅ smoke 6/6 in Chromium, Firefox, WebKit |
| 2 Coverage | tests 99.28 % stmts / 95.67 % branches / 100 % funcs / 99.9 % lines (ratchet thresholds met) · docs 309/309 = 100 % |
| 3 SonarQube | run by the pre-push hook (`make verify`) |
| 4 Secrets | ✅ gitleaks clean · only `.env.example` tracked · diff read: nothing sensitive |
| 5 QA pass | ✅ headless Chromium, a seeded top 1 *BENOIT*, 44 s of play: the name drifts dimly under the enemies and shots; console and page errors none · `docs/architecture/qa/2026-10-16-champion-name-44s.png` |

## 🔴 Must Have
_None._

## 🟡 Should Have (fixed in this branch)
- `src/domain/scenes/scene-machine.ts` `[design|correctness]` · the name vanished in the pause, against GDD §9.4.1 · now frozen in every frozen, non-scrolling scene; test added.
- `docs/architecture/diagrams/render/04-class-champion-name.md` `[docs]` · entry height −8 vs code −10 · doc corrected.
- `src/domain/save/save-store.ts` `[security]` · a saved `null` read as on · only a missing key reads as on; `null` test added (ADR-0006).
- `tests/domain/scene-machine.test.ts` `[tests]` · duplicate `ALL_ON` · removed.

## 🔵 Nice to Have (deferred)
- `tests/**` `[tests]` · every effects literal repeats each switch · a shared `allEffects(on)` test helper.
- `src/domain/scenes/scene-machine.ts` `[design]` · layer indices 0/1 leak into the scene machine · `drawFar`/`drawNear` with a UML update.
- `src/domain/scenes/scene-machine.ts` `[design]` · 7 positional constructor parameters · an options object, own refactor.

## ⚪ Disagree / Intentional
- `ChampionName` keeps its pass and x: needed so the x is drawn once per pass (ADR-0010).
- A `far` font id rather than alpha: the render port has no alpha (UML context).

## Per-dimension summary
- Design: small presentation class, no over-engineering. · Docs: GDD/UML aligned (run start, pause, −10). · Tests: unit + scene + adapter + save cases. · Security: names already allowlisted, switch parsed strictly. · Correctness: pass arithmetic tested.
