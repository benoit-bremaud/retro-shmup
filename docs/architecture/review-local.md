# Local review — retro-shmup (feat/ui-feedback-form)

- Date: 2026-10-19
- Scope: branch diff origin/main...HEAD (feedback form, #122, ADR-0027, GDD v0.26 §9.1)
- Checks run: design (architecture-guardian) · security + correctness (opus review) · tests (test-engineer pass) · docs
- Verdict: ship — all Must and Should fixed · Must 0 · Should 0 open · Nice 4 (below)

## Pre-merge gate
| Step | Result |
|---|---|
| 1 Tests | ✅ 1615 unit/integration (Vitest) · ✅ 6/6 browser smoke (`make smoke`) |
| 2 Coverage | 99.3 % stmts / 95.8 % branches / 100 % funcs / 99.9 % lines (floor 80) · docs 100 % |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: placeholder form address only |
| 5 QA pass | ✅ full · console and page errors none · Tally stubbed by route · screenshots: `qa/2026-10-19-feedback-title-mobile.png`, `qa/2026-10-19-feedback-offer-desktop.png` |
- Gate: **GREEN**

## 🔴 Must Have (fixed)
- `device-input.ts` `[security|correctness]` · Esc opened the tab on the gesture prompt · `isBackKey` excluded from `keys: 'any'`.
- `scene-machine.ts` `feedbackOpened` `[design|correctness]` · a second opening from the title reused set 1 · disarm after counting.
- `device-input.ts` `openOnLift` vs `PressGuard` `[design|correctness]` · a lift the menu ignored opened a tab uncounted · an `opened` outcome now counts as the activation.
- `scene-machine.ts` `step` `[correctness]` (found in QA) · a tap sent `device=keyboard` · a device change re-arms with a fresh context.

## 🟡 Should Have (fixed)
- Offer without the 1 s lock (hammered Enter opened a tab) · lock + disarm while locked.
- `lastLevel` never assigned · `SLICE_LEVEL` constant until the snapshot carries a level.
- Magic row index 3 · `rows.indexOf('feedback')`. Timings moved to `SceneTuning`. `releaseRun()` extracted (third copy).
- Title font has no `?` (offer header threw) · *YOUR OPINION* / *TON AVIS*, GDD amended.

## 🔵 Nice to Have
- Stale highlight within one frame (Up+Enter between two steps).
- *OPEN BLOCKED* can last ~3 s after a refusal from the gesture prompt (title lock pauses the countdown).
- Enter + click in one frame open two tabs, counted once.
- `feedbackVersion` duplicated in `SceneMachine` and `FeedbackFlow` settings.

## ⚪ Disagree / Intentional
- `DeviceInput implements InputPort, LinkPort` · the tab must open in the input handler (ADR-0027 decision 5).
- `window.open` without `noopener`, then `opener = null` · keeps the refused signal; COOP same-origin also isolates.

## Per-dimension summary
- Design: seams justified, small smells fixed · Docs: GDD/UML 04 updated, JSDoc 100 % · Tests: new feedback suites, regressions for each fix · Security: allowlisted URL, no PII, parse never throws · Correctness: four flow bugs fixed.
