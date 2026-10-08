# retro-shmup (codename)

A starfighter against a mechanical armada. Shoot the ships that pour down the screen, catch the
power-ups they drop, grow from a pea-shooter to a screen-filling barrage, survive three levels and
their bosses. Short, readable, juicy, fair.

A retro vertical-scrolling shoot'em up for the browser, in the 16-bit arcade tradition (1942,
Raiden, DoDonPachi). TypeScript strict and native Canvas 2D, no game framework. Release target:
itch.io (web build) for 1.0; Steam considered later. Solo project by Benoît Bremaud.

The codename is deliberate: the commercial title is still open and the repository will be renamed
when it is chosen.

## Status

**Vertical slice in progress.** The design is complete — GDD, the
[ADRs](docs/decisions/README.md) and the UML study — and the code now follows it, one pull request per brick, up to level 1 at release
quality. `pnpm install` then `pnpm dev` shows the engine running: a scrolling starfield between
the HUD bands, nothing playable yet; see CONTRIBUTING.md.

Roadmap (GDD section 11):

- **1.0** — 3 levels and 3 bosses, 5 enemy roles, 2 weapons with 5 power levels, 5 pickups, chain
  scoring and end-of-level tally, keyboard / touch / gamepad / mouse, local top 10, options
  (volume, remap, language, accessibility), EN / FR, credits, itch.io release.
- **1.x** — boss practice, level select, Easy / Hard profiles, CRT overlay, run statistics,
  limited continues, mid-bosses, ground targets, the ejected-pilots rescue mechanic (GDD section
  12), custom art and music.
- **v2** — online leaderboard, replays (enabled by determinism), PWA / offline, endless mode,
  Steam build.

## Documentation

- [Game Design Document](docs/design/game-design-document.md) — the design contract, with the
  decision record of every rejected alternative.
- [Architecture Decision Records](docs/decisions/) — Nygard format, one file per decision:
  - [ADR-0001](docs/decisions/ADR-0001-rendering-canvas2d-behind-render-port.md) — Native
    Canvas 2D rendering behind a minimal `RenderPort`
  - [ADR-0002](docs/decisions/ADR-0002-fixed-timestep-deterministic-simulation.md) — Fixed
    60 Hz timestep, deterministic simulation, performance budget
  - [ADR-0003](docs/decisions/ADR-0003-object-composition-patterns-and-test-strategy.md) —
    Object composition with justified patterns (no ECS, no inheritance tree), ports, and the
    test strategy
  - [ADR-0004](docs/decisions/ADR-0004-delivery-cloudflare-pages-and-itchio.md) — Delivery:
    Cloudflare Pages for previews and production, itch.io for releases
  - [ADR-0005](docs/decisions/ADR-0005-licensing-mit-code-separate-asset-licences.md) — MIT
    for the code, separate licences for assets
  - [ADR-0006](docs/decisions/ADR-0006-player-data-local-storage-no-backend.md) — Player data
    in `localStorage`, versioned, no backend in 1.0
  - [ADR-0007](docs/decisions/ADR-0007-local-first-quality-gate-minimal-ci.md) — Local-first
    quality gate, minimal CI
  - [ADR-0008](docs/decisions/ADR-0008-hosting-per-game-subdomain-on-benoitbremaud-fr.md) —
    Public hosting: one subdomain per game on benoitbremaud.fr, catalogue on the portfolio
- [Architecture and UML study](docs/architecture/README.md) — C4 context and containers, then
  the UML diagrams (Mermaid, PlantUML for use cases and components) and the traceability matrix.
- [PROJECT_LOG.md](PROJECT_LOG.md) — operational logbook (what was done, why, by which PR).
- [CHANGELOG.md](CHANGELOG.md) — release changelog (Keep a Changelog).
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow, branches, commits, labels, design-before-code.
- [SECURITY.md](SECURITY.md) — vulnerability reporting and security practices.
- [CREDITS.md](CREDITS.md) — every third-party asset and tool, mirrored by the in-game credits.

## Design at a glance

| Topic | Decision |
|---|---|
| Resolution | 240 × 320 px internal (3:4 arcade vertical), integer scaling, nearest-neighbour sampling |
| Scrolling | Vertical: enemies enter from the top (and sides), the player's ship lives in the lower third |
| Player | 32 × 32 px sprite, 4 × 4 px hitbox, one hit = one life, 3 lives, one-charge shield, stock bombs |
| Weapons | Spread (red) and Laser (blue), five shared power levels; death costs one level and releases it as a pickup |
| Enemies | 5 roles (Popcorn, Diver, Gunner, Carrier, Heavy) on 3 size tiers, defined as data, not classes |
| Bosses | One per level, HP-threshold phases that break parts off the sprite, 90 s timer |
| Levels | 3 declarative, typed, deterministic scripts; about 2 min of waves plus a boss each |
| Scoring | Base points, chain multiplier ×1 to ×8, end-of-level tally, local top 10 with initials |
| Inputs | Keyboard (P0), touch and gamepad (P1), mouse (P2), all translated to device-agnostic intents |
| Tech | TypeScript strict, native Canvas 2D behind a `RenderPort`, fixed 60 Hz timestep, object pools, no framework |

Every numeric value is an initial setting to be tuned in playtests; the rules themselves are fixed.

## Conventions

- **Conventional Commits** (`<type>(<scope>): <description>`), with the project scope list in
  [CONTRIBUTING.md](CONTRIBUTING.md).
- **Branches** from `main` only, named `feat/<scope>`, `fix/<scope>`, `refactor/<scope>`,
  `chore/<scope>`, `docs/<scope>`. `main` is protected; every change goes through a PR.
- **Labels triptych** on every issue and PR: one `type:*`, one `area:*`, one `priority:*`.
- **PROJECT_LOG.md discipline**: an entry after every merged PR, most recent first.
- **ADRs** for every technical decision; a decision is superseded by a new ADR, never edited in
  place. Design changes go through a GDD revision in its own PR.
- **Design before code**: a feature is coded only after its GDD rules exist and its UML diagrams
  are validated.
- **Quality gate, local first** (ADR-0007): git hooks run gitleaks, lint, typecheck, the tests
  with coverage and the local SonarQube quality gate before every push; CI keeps only Gitleaks
  and a light lint / typecheck / test job.

## Licence

The split is recorded in ADR-0005:

- **Code** — [MIT License](LICENSE), Copyright (c) 2026 Benoît Bremaud.
- **Assets** — sprites, music and sound effects under `public/assets/` keep their own licences
  (CC0, CC-BY or custom). Each one is credited in [CREDITS.md](CREDITS.md) and on the in-game
  credits screen. The MIT licence does not cover them.
