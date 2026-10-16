# Local review — retro-shmup (feat/audio-music: G3-2)

- Date: 2026-10-16
- Commit: c9a17f3 (feat/audio-music merged with main)
- Scope: branch diff origin/main...HEAD
- Checks run: design · docs · tests · security · correctness
- Verdict: ship — Must 0 · Should 1 open · Nice 5 open

## Pre-merge gate (head SHA c9a17f3)
| Step | Result |
|---|---|
| 1 Tests | ✅ 1475 unit/simulation (Vitest) · ✅ 6 smoke (Chromium, Firefox, WebKit) |
| 2 Coverage | ratchet thresholds held by `make verify` · docs 100 % |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: CC0 audio, code, docs only |
| 5 QA pass | ✅ full (Chromium): title music within 100 ms of unlock, level-1 loop, pause duck 0.25 then back to 1, game-over jingle then title, Audio screen in French, volumes saved across reload, console clean, six MP3 200 · screenshots: `docs/architecture/qa/2026-10-16-g3-2-*.jpg` |
- Gate: **GREEN — merge authorised**

## 🔴 Must Have
_None._

## 🟡 Should Have
- `src/domain/scenes/scene-machine.ts` `[design]` · the controls and name-entry sounds diff the screens' state before and after a step (Feature Envy) · give each screen a `feedback` getter; follow-up.

## 🔵 Nice to Have
- `src/adapters/web-audio-player.ts` `[correctness]` · loop gaps of MP3 not measured in Firefox and WebKit (Chromium decodes exact lengths).
- `src/adapters/web-audio-player.ts` `[design]` · `setTargetAtTime` for volume changes.
- `src/domain/scenes/scene-machine.ts` `[correctness]` · skip the save when a nudge hits a bound; un-duck when quitting to the title.
- `src/domain/options.ts` `[design]` · use `RowValue` everywhere.
- QA `[tests]` · warning fade, boss intro/loop and Results jingle covered by headless tests only, not played in the browser.

## ⚪ Disagree / Intentional
_None._

## Per-dimension summary
- Design: no Must; one Should deferred · Docs: UML and CREDITS match the code · Tests: adapter, scene music, volumes, save covered · Security: no new sink, save input allowlisted · Correctness: title-music delay found in QA and fixed (4a496cb)
