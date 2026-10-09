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
| ADR-0009 | Input and audio contracts | Flat reusable intent frame (movement, held / pressed masks, device, tap), bindings and capture, gestures in the input adapter, audio mix control. |
| ADR-0010 | Presentation outside the outcome | Separate random streams, time effects in the loop, `RunPresenter`, one ordered bus per run, `DropTable` as data, HUD region. |
| ADR-0011 | Toolchain | pnpm, Vite 8, TypeScript ~6.0 (typescript-eslint support), Vitest 5, ESLint 10 strict type-checked, Prettier on code, husky hooks running `make verify`. |
| ADR-0012 | Binding shapes | Keyboard slots hold `KeyboardEvent.code`, gamepad slots hold standard-mapping indices; primary slot never empty; capture as a discriminated union. |
| ADR-0013 | Quality gate and CI after going public | Partially supersedes ADR-0007: CI table (CodeQL with TypeScript, Dependency Review, Scorecard weekly and non-blocking) and the audit exceptions of the local gate. |
| ADR-0014 | Logical screen and render regions | Partially supersedes ADR-0001 (off-screen size, scale formula, field-only shake at draw time): 480 × 320 logical screen (field centred, 120 px HUD bands), integer scale in device pixels, domain `dt` in seconds. |
| ADR-0015 | Device input and the portrait screen | Partially supersedes ADR-0014 (decision 6; decisions 1 to 4 now landscape-only): portrait screen chosen when it fits with the larger integer scale, `RenderPort.layout()`, `DeviceInput` as a façade with injected browser objects, devices combined, gamepad polling, Pointer Events and gestures, default bindings. |
