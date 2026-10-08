# Architecture Decision Records

Nygard-format ADRs, one file per decision, named `ADR-NNNN-<kebab-slug>.md`. Status changes
(superseding, deprecating) require a dedicated PR, never an edit in passing (see `CLAUDE.md`).
The design decisions these ADRs implement are fixed in the
[Game Design Document](../design/game-design-document.md), §13 and the Decision record.

| ADR | Title | Gist |
|---|---|---|
| ADR-0001 | Rendering | Native Canvas 2D behind a minimal `RenderPort`; 240 x 320 integer-scaled; no framework. |
| ADR-0002 | Timestep, determinism and performance | Fixed 60 Hz accumulator loop, render interpolation, seeded RNG, no allocation in the loop. |
| ADR-0003 | Architecture and tests | Composition + patterns, ports for browser APIs, UML-first; test pyramid with headless level simulation. |
| ADR-0004 | Delivery | Cloudflare Pages PR previews (staging) and `main` production; itch.io releases via butler on tag push. |
| ADR-0005 | Licensing | MIT for the code; assets under their own licences in `public/assets/` with `CREDITS.md`. |
| ADR-0006 | Player data | `localStorage` only, versioned key, no personal data beyond three initials; no backend in 1.0. |
| ADR-0007 | Quality gate | Local-first: husky hooks run gitleaks, lint, typecheck, tests with coverage and the local SonarQube gate before every push; CI keeps Gitleaks and a light `ci.yml` only. |
| ADR-0008 | Public hosting | One first-level subdomain per game on `benoitbremaud.fr` (own Pages project, own `_headers`); catalogue page `/jeux/` on the portfolio. |
| ADR-0009 | Input and audio contracts *(Proposed)* | Flat reusable intent frame (movement, held / pressed masks, device, tap), bindings and capture, gestures in the input adapter, audio mix control. |
| ADR-0010 | Presentation outside the outcome *(Proposed)* | Separate random streams, time effects in the loop, `RunPresenter`, one ordered bus per run, `DropTable` as data, HUD region. |
