# CLAUDE.md — retro-shmup

## Project overview

**Name:** retro-shmup (codename — the commercial title is still open; the repository will be
renamed when it is chosen).
**Type:** retro vertical shoot'em up for the browser. TypeScript strict + native Canvas 2D,
240 × 320 pixel-perfect, 16-bit pixel art. Release target: itch.io (web), Steam considered later.
**Status:** **vertical slice** in progress (design complete: GDD v0.4, ADR-0001..0011, UML study).
The design contract is
[docs/design/game-design-document.md](docs/design/game-design-document.md); technical decisions are
ADRs under [docs/decisions/](docs/decisions/); the UML study lives under
[docs/architecture/](docs/architecture/README.md).
**Language:** English only in the repository (code, comments, commits, docs, issues, PRs).

Global rules (Conventional Commits, branch from `main`, no `any`, no default exports, pre-push
review gate, private-first, security defaults) are inherited from `~/.claude/CLAUDE.md` and
`~/.agent-rules/common.md` — not duplicated here. Below are the rules that apply **only** to this
repository.

## Non-negotiables (project)

- **Security policy applies to every change.** The owner's `security-policy` (OWASP 2025 rules
  INJ, INPUT, SECRET, ERR, CONFIG, SUPPLY, PRIV) and `security-ci-baseline` are checked on every
  diff; any security finding is a Must Have. Mechanically enforced: ESLint bans `eval`,
  `new Function`, `javascript:` URLs and HTML sinks (`innerHTML`, `insertAdjacentHTML`,
  `document.write`); `make verify` runs gitleaks, `pnpm audit --audit-level high` and SonarQube.
  Untrusted inputs of this game — the `localStorage` save document, the URL, files later — are
  validated by allowlist and parsing never throws (ADR-0006).

- **Design before code.** A feature is implemented only after (1) its rules exist in the GDD and
  (2) its UML diagrams (use-case, class, state, sequence as relevant) are validated. Diagrams are
  Mermaid under `docs/architecture/diagrams/<feature>/`.
- **Validated decisions are not reopened silently.** The GDD *Decision record* and the ADRs list
  what was chosen and what was rejected. Changing one requires a new ADR (superseding) or a GDD
  revision in its own PR, never an implicit drift in code.
- **The domain never imports the browser.** Gameplay code depends on `RenderPort`, `AudioPort`,
  `InputPort` and a clock abstraction; `canvas`, `window`, `AudioContext` appear only in adapters.
- **Fixed timestep, deterministic simulation.** 60 Hz accumulator loop, seeded RNG, no
  `Date.now()` / `Math.random()` inside the simulation. Level scripts must replay identically.
- **No allocation inside the game loop.** Bullets, particles and pickups come from object pools.
- **Every player-facing string goes through the message catalogue** (EN default, FR).
- **Every game-feel effect is toggleable** and respects the photosensitivity options.
- **Tests:** unit tests on the domain (TDD — Red/Green/Refactor), headless level-simulation tests
  with scripted inputs and seeded RNG, exactly one browser smoke test. Render and audio are
  mocked at their ports, never the domain.

## Repository layout

```
docs/design/        GDD and design annexes
docs/decisions/     ADRs (Nygard format, ADR-NNNN-<slug>.md)
docs/architecture/  UML diagrams (Mermaid), later: architecture notes
.github/            CI (security baseline), templates, protection docs
src/ · tests/ · public/assets/   — created with the vertical slice
```

## Commit scopes (Conventional Commits)

`design` (GDD), `adr`, `uml`, `docs`, `ci`, `repo` (root config, tooling), and — once code
exists — `engine` (loop, ports, pools), `game` (domain rules), `render`, `audio`, `input`, `ui`,
`levels`, `assets`, `i18n`, `tests`.

Branch naming: `feat/<scope>`, `fix/<scope>`, `refactor/<scope>`, `chore/<scope>`, `docs/<scope>`.

## Labels

Triptych on every issue and PR: one `type:*` (feature, bug, refactor, chore, docs, test, task,
epic), one `area:*` (`design`, `uml`, `engine`, `game`, `render`, `audio`, `input`, `ui`, `levels`,
`assets`, `ci`, `docs`), one `priority:*` (high, medium, low).

## Quality gate — local first (ADR-0007)

- The blocking gate runs **locally**: `pre-commit` (gitleaks on staged files, lint) and
  `pre-push` = `make verify` (typecheck, Vitest with coverage, gitleaks on the pushed range,
  `sonar-scanner` against the local SonarQube at `localhost:9000` with quality-gate wait).
- CI keeps the necessary minimum: `gitleaks.yml` and a light `ci.yml` (lint, typecheck, tests).
  No SonarCloud, no coverage service, no E2E in CI. CodeQL (matrix `actions`, plus
  `javascript-typescript` once code exists) and Dependency Review run since the repository went
  public.
- The SonarQube analysis token lives in `~/.config/sonar-tokens/retro-shmup` — never in the repo.
- `git push --no-verify` is a conscious exception, allowed only when SonarQube is down and the
  rest of `make verify` passed.

## Workflow reminders

- Open a branch for every change; `main` is protected (PR + green checks).
- Run the local pre-push review gate (`review-local`) before every push.
- After every merged PR: update `PROJECT_LOG.md` (entry per the project-log discipline),
  post-merge cleanup, memory compression.
- The repository is **private** until the public-release checklist in `~/.claude/CLAUDE.md` is
  fully satisfied; the owner approves the switch explicitly.

## Forbidden — never without explicit owner request

- Adding a game framework or rendering library (Phaser, PixiJS…) — see ADR-0001 / ADR-0003.
- Introducing an ECS or an enemy inheritance tree — see ADR-0003.
- Any backend, account system or network call in 1.0.
- Editing `.github/workflows/*` protection semantics, `LICENSE`, or the ADRs' *Status* without
  a dedicated PR.
