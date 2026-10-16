# Local review — retro-shmup (GDD v0.23 audio design)

- Date: 2026-10-16
- Commit: design commit 7801629 + review fixes
- Scope: branch diff origin/main...docs/design-audio (docs only)
- Checks run: design · docs (architecture-guardian on the docs diff); tests, security and correctness have no code to review
- Verdict: ship after the fixes below (applied) · Must 2 · Should 5 · Nice 3

## Pre-merge gate (head of docs/design-audio)
| Step | Result |
|---|---|
| 1 Tests | ✅ 1 323 unit/simulation (66 files) · ✅ smoke 6/6 (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.28 % stmts / 95.67 % branches / 100 % funcs / 99.9 % lines (floor 80) · docs 100 % (309/309) |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive |
| 5 QA pass | ✅ smoke only (docs-only diff) |
- Gate: **GREEN**

## 🔴 Must Have
- `diagrams/audio/04-class-audio.md` `[design|docs]` · adapter named `WebAudioOutput` and a separate listener drifted from the component diagram (`WebAudioPlayer`, RunPresenter maps events to SFX, ADR-0010) · fixed: `WebAudioPlayer`, `RunSounds` is a module RunPresenter delegates to; component diagram and traceability matrix updated
- `04-class-audio.md` / GDD §9.5 `[design]` · the synthesiser's seed could be read as the run's stream (determinism, ADR-0002) · fixed: own `SeededRandom`, a constant seed per sound

## 🟡 Should Have
- `04-class-audio.md` `[design]` · arrows from data/pure functions · fixed: SceneMachine drives music, volumes and pause
- `04-class-audio.md` `[design]` · the adapter's UI-sound and track tables were missing (ADR-0009) · fixed: `UI_SOUNDS`, `TRACKS`
- GDD §9.5 `[docs]` · volume allowlist on load not stated (ADR-0006) · fixed
- GDD §9.5 `[docs]` · stale "Press Start" autoplay line · fixed
- `docs/architecture/README.md` `[docs]` · index missing the audio diagram · fixed

## 🔵 Nice to Have
- `04-class-audio.md` `[docs]` · UML attribute syntax, a main.ts participant, only resume() inside the gesture · all applied

## ⚪ Disagree / Intentional
- One `AudioBufferSourceNode` per `play`: Web Audio sources are single-use and live outside the simulation; not a pool violation.

## Per-dimension summary
- Design: sound, no over-engineering · Docs: drift fixed · Tests / Security / Correctness: no code in the diff
