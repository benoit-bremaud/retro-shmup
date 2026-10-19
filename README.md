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
[ADRs](docs/decisions/README.md) and the UML study — and the code follows it, one pull request
per brick, up to level 1 at release quality. Every merge to `main` is playable at
<https://retro-shmup.pages.dev> (ADR-0016).

What the current build plays:

- **Enemies**: the 120 s script of level 1 — Popcorn formations, Divers, Gunners, Heavies firing
  turning rings or aimed fans, and two Carriers crossing the field, one with a Shield, one with a
  1-UP; the script loops every 120 s until the boss arrives; aimed bullets, contact hits.
  Level 1 is rebalanced three times (GDD v0.11 and v0.12, #45; v0.18, #56): fewer drops, two more
  Popcorn per opening formation, enemy bullets at 85 px/s, tougher Gunners firing every 0.8 s,
  tougher Heavies, four of the seven formations paying no P, and a Cruiser of 1 800 shots with
  faster volleys. A seeded measurement bot (`tests/balance`) guards the balance.
- **Player kit**: the Spread (red) and the Laser (blue) on five shared power levels, the weapon
  chosen by the colour of the last P caught; a Laser bolt stops on the first enemy it touches. A P
  drops from Gunners (10 %) and from every fully destroyed Popcorn formation that pays it (three of the seven in level 1, GDD v0.18). Shield, Bomb and
  1-UP pickups, with a 1 000-point bonus at the cap; Heavies drop a Bomb or a Shield at 30 %.
  Bombs, 2 per life up to 5, cancel every enemy bullet and hit every enemy on the field; the
  shield absorbs one hit; a death costs a power level, released as a P to catch back, and resets
  the bombs to 2.
- **Rules**: 3 lives, a 6 × 6 hitbox, respawn with invulnerability; score with a chain
  multiplier ×1 to ×8; an arcade Game over over the running wave.
- **Screens**: title, play, pause with a 3-2-1 count-in, Game over; a landscape screen with side
  HUD bands, or a portrait screen with a top HUD strip on phones. The bomb flash and the field
  shake are off by default under reduced motion.
- **Devices**:
  - keyboard: arrows or `W A S D` move, `Space` / `Z` fire, `X` / `Left Shift` bomb, `P` / `Esc`
    pause, `Enter` confirm;
  - touch: the ship follows the finger 32 px above it and fires while the finger steers, a second
    finger on the field bombs, a pause button in the HUD, any tap resumes;
  - mouse: the ship follows the crosshair and fires while the left button pressed on the field is
    held, a right click on the field bombs, a left click outside the field taps;
  - gamepad: stick or d-pad, `A` fire, `B` bomb, `Start` pause and confirm.

Play it at <https://retro-shmup.pages.dev>, or locally with `pnpm install` then `pnpm dev` (see
CONTRIBUTING.md). Level 1 now ends in the Cruiser, its boss: a 3 s warning, a 90 s fight in two
phases, a bonus for the seconds left, with a WARNING banner, an HP bar and the seconds left
(the ships are CC0 placeholder sprites from Kenney's *Pixel Shmup*, drawn as shapes if the
images fail to load). Explosions are animated, the turret breaks into debris
and the boss dies in a chain of bursts with a short slow motion. The level ends on the Results
screen: the tally of formations, no bomb, no miss and bombs left, added to the score, then the
title. The screens brick (G1–G2) added the menus, the options, the hall of fame and the Ending;
G4-1 draws the ships as sprites. G3 added the sound: 8-bit sound effects from the game's own
synthesiser, CC0 chiptune music by SketchyLogic, and an *Audio* options screen with two volumes.

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
- [Architecture Decision Records](docs/decisions/README.md) — Nygard format, one file per
  decision; the index gives the gist of each and what it supersedes:
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
  - [ADR-0009](docs/decisions/ADR-0009-intent-frame-and-audio-port-contracts.md) — Input and
    audio contracts: intent frame, bindings, gestures, mix control
  - [ADR-0010](docs/decisions/ADR-0010-presentation-outside-the-simulation-outcome.md) —
    Presentation never changes the outcome of a run
  - [ADR-0011](docs/decisions/ADR-0011-toolchain.md) — Toolchain: pnpm, Vite, TypeScript 6,
    Vitest, ESLint, local quality hooks
  - [ADR-0012](docs/decisions/ADR-0012-binding-shapes.md) — Shapes of the remappable bindings
    and of the key capture
  - [ADR-0013](docs/decisions/ADR-0013-quality-gate-and-ci-update.md) — Quality gate and CI
    after going public
  - [ADR-0014](docs/decisions/ADR-0014-logical-screen-and-render-regions.md) — Logical screen
    480 × 320, render regions and step units
  - [ADR-0015](docs/decisions/ADR-0015-device-input-and-portrait-screen.md) — Device input in
    practice and the portrait screen
  - [ADR-0016](docs/decisions/ADR-0016-deploy-every-playable-build.md) — Deploy every playable
    build, from the first playable on
  - [ADR-0017](docs/decisions/ADR-0017-games-catalogue-in-the-projects-page.md) — The games
    catalogue is a category of the portfolio's projects page
  - [ADR-0018](docs/decisions/ADR-0018-device-input-after-the-enemies-brick.md) — Device input
    after the enemies brick: pause button, taps, takeover and rounding
  - [ADR-0019](docs/decisions/ADR-0019-player-kit-seeded-randomness-tenths-weapons-as-data.md) —
    Player kit: seeded randomness per run, damage in tenths, weapons as data
  - [ADR-0020](docs/decisions/ADR-0020-pointer-fire-held-button-and-steering-finger.md) — Pointer
    fire: held button and steering finger, autofire as an option
  - [ADR-0021](docs/decisions/ADR-0021-hall-of-fame-entry-name-and-optional-country.md) — Hall of
    fame entry: an 8-character name and an optional country
  - [ADR-0022](docs/decisions/ADR-0022-level-brick-strategy-factories-boss-outside-the-pool-one-level-slice.md)
    — Level brick: strategy factories, the boss outside the enemy pool, a one-level slice
  - [ADR-0023](docs/decisions/ADR-0023-boss-fight-one-timer-per-attack-movement-age-boss-bonus-tuning-three-prs.md)
    — Boss fight: `fire` and `tick` patterns with one timer, movement age, the boss bonus in
    `BossTuning`, F-2 in three PRs
  - [ADR-0025](docs/decisions/ADR-0025-versioning-policy.md) — Versioning policy: SemVer, the
    save document as public surface, manual signed releases
- [Architecture and UML study](docs/architecture/README.md) — C4 context and containers, then
  the UML diagrams (Mermaid, PlantUML for use cases and components) and the traceability matrix.
- [PROJECT_LOG.md](PROJECT_LOG.md) — operational logbook (what was done, why, by which PR).
- [CHANGELOG.md](CHANGELOG.md) — release changelog (Keep a Changelog).
- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow, branches, commits, labels, design-before-code.
- [SECURITY.md](SECURITY.md) — vulnerability reporting and security practices.
- [CREDITS.md](CREDITS.md) — every third-party asset and tool, mirrored by the in-game credits.

## Versioning

[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). The game is in initial
development (`0.y.z`): the first tag, `v0.1.0`, comes with the rebalanced vertical slice, and
`1.0.0` is the public release on itch.io. The public surface is the save document and the URL
parameters, not the balance. The [CHANGELOG](CHANGELOG.md) lists the changes, releases and their
notes will be on the GitHub releases page; the policy is ADR-0025 and the procedure is in
[CONTRIBUTING.md](CONTRIBUTING.md#versioning-and-releases).

## Design at a glance

| Topic | Decision |
|---|---|
| Resolution | 240 × 320 px play field (3:4 arcade vertical) in a landscape or portrait logical screen (GDD §3.1), integer scaling, nearest-neighbour sampling |
| Scrolling | Vertical: enemies enter from the top (and sides), the player's ship lives in the lower third |
| Player | 32 × 32 px sprite, 6 × 6 px hitbox, one hit = one life, 3 lives, one-charge shield, stock bombs |
| Weapons | Spread (red) and Laser (blue), five shared power levels; death costs one level and releases it as a pickup |
| Enemies | 5 roles (Popcorn, Diver, Gunner, Carrier, Heavy) on 3 size tiers, defined as data, not classes |
| Bosses | One per level, HP-threshold phases that break parts off the sprite, 90 s timer |
| Levels | 3 declarative, typed, deterministic scripts; about 2 min of waves plus a boss each |
| Scoring | Base points, chain multiplier ×1 to ×8, end-of-level tally, local top 10 with a name of up to 8 characters and an optional country |
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
- **Quality gate, local first** (ADR-0007, ADR-0013): git hooks run gitleaks, lint, typecheck,
  the tests with coverage, `pnpm audit` and the local SonarQube quality gate before every push;
  CI keeps a light `ci.yml` (lint, typecheck, format, tests, build) and the security workflows
  (Gitleaks, CodeQL, Dependency Review, OSSF Scorecard).

## Privacy

The game keeps everything on your device (`localStorage`): your options, your country choice and
the local top 10. It makes no network request and has no account.

The optional **feedback** row opens an external form (Tally, hosted in the EU) in a new tab. It
receives only what you type there and a few context values in its address: the question set, the
game version, your last score and level, your country code if you chose one, the device you used
and the game language — never your name. The form is anonymous: please do not write names,
e-mail addresses or other personal data in it. Answers are read by the author to improve the game
and deleted after 12 months.

## Licence

The split is recorded in ADR-0005:

- **Code** — [MIT License](LICENSE), Copyright (c) 2026 Benoît Bremaud.
- **Assets** — sprites, music and sound effects under `public/assets/` keep their own licences
  (CC0, CC-BY or custom). Each one is credited in [CREDITS.md](CREDITS.md) and on the in-game
  credits screen. The MIT licence does not cover them.
