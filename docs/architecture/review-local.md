# Local review — retro-shmup (G3-1 audio: synthesiser, Web Audio player, sound effects)

- Date: 2026-10-16
- Commit: feat/audio-sfx head
- Scope: branch diff origin/main...feat/audio-sfx
- Checks run: design · docs · tests · security · correctness (architecture-guardian covering all five on the diff)
- Verdict: ship — every finding below fixed · Must 1 · Should 4 · Nice 4 (+ SonarQube S107)

## Pre-merge gate (head of feat/audio-sfx)
| Step | Result |
|---|---|
| 1 Tests | ✅ 1 378 unit/simulation · ✅ smoke 6/6 (Chromium, Firefox, WebKit) |
| 2 Coverage | tests 99.26 % stmts / 95.67 % branches / 100 % funcs / 99.9 % lines (ratchet floors met) · docs 100 % (328/328) |
| 3 SonarQube | ✅ PASSED (first run FAILED on S107, fixed) |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive |
| 5 QA pass | ✅ dev server in the browser pane: the first key unlocks the context (`running`), menu move and confirm, shots and enemy shots create sources; console clean · screenshot `docs/architecture/qa/2026-10-16-g3-1-audio-pause.jpg` |
- Gate: **GREEN**

## 🔴 Must Have
- `src/adapters/input/device-input.ts` `[correctness]` · a touch grants user activation on release, ADR-0009 lists `touchend` · fixed: `unlockAudio` on pointer up too

## 🟡 Should Have
- `src/domain/scenes/scene-machine.ts` `[docs|design]` · constructor JSDoc displaced; SonarQube S107 (8 parameters) · fixed: `SceneOutputs { champion, audio }`, doc moved
- `src/adapters/web-audio-player.ts` `[docs]` · five `*Like` interfaces undocumented (doc 98.5 %) · fixed, 100 %
- GDD §9.5 / `04-class-audio.md` `[docs]` · chain step, tally tick and the controls / name-entry menu sounds absent without a note · now stated as G3-2 (*planned*)
- `tests/domain/scene-sounds.test.ts` `[tests]` · pause mix only tested Paused → Count-in · added Confirm quit → title and the pause options

## 🔵 Nice to Have
- `world.ts` shot counters writable → private with getters · `PAUSE_MIX_SCENES` explicit set instead of trait arithmetic · `playOn` rename · UML drift (`UI_SOUNDS` in the domain, `volumeGain` from main) — all applied

## ⚪ Disagree / Intentional
- Shot counters instead of events (owner, 470/500) · `SILENT_AUDIO` default · `*Like` seam (ADR-0015 decision 4) · one source node per `play`, outside the simulation

## Per-dimension summary
- Design: no over-engineering, domain browser-free · Docs: 100 % · Tests: behaviour at the port, no domain mocks · Security: no untrusted input · Correctness: repeat guard, voice ring, suspend checked
