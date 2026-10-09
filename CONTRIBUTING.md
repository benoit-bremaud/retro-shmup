# Contributing to retro-shmup

This guide covers the workflow, the conventions and the quality bar of the repository. The project
is a solo effort for now, but every rule below applies to the owner as much as to any contributor.

Everything in the repository is written in English: code, comments, commits, documentation, issues
and pull requests.

## Prerequisites

- **Git** 2.30 or newer, **Node.js 22 LTS** (≥ 22.22.1 — lint-staged 17's floor; see `.nvmrc`),
  **pnpm 10**.
- **gitleaks** ≥ 8.25 (`.gitleaks.toml` uses `[[allowlists]]`) and **sonar-scanner** on the `PATH`, and the local **SonarQube** at
  `http://localhost:9000` — the git hooks use them (ADR-0007, ADR-0011).

```bash
git clone git@github.com:benoit-bremaud/retro-shmup.git
cd retro-shmup
pnpm install          # also installs the git hooks (husky)
pnpm dev              # dev server
make verify           # the full local gate, as run by the pre-push hook
pnpm exec playwright install chromium   # once, for the browser smoke test (make smoke)
```

**One-time SonarQube setup**: in SonarQube, create the project `retro-shmup` (manual setup, main
branch `main`), generate a *project analysis token* for it, and store it outside the repository.
The command asks for the token with hidden input, so it never reaches the shell history, and
forces mode 600 even on an existing file:

```bash
(umask 077; mkdir -p ~/.config/sonar-tokens; printf 'Token: '; read -rs t; echo; printf '%s' "$t" > ~/.config/sonar-tokens/retro-shmup; chmod 600 ~/.config/sonar-tokens/retro-shmup)
```

## Branching strategy

Trunk-based development with `main` as the single production branch. `main` is protected: pull
request required, checks green, no force push, no deletion. Never commit directly to `main`.

Every task gets a dedicated branch from an up-to-date `main`:

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<scope>` | `feat/uml-player-ship` |
| Bug fix | `fix/<scope>` | `fix/docs-broken-links` |
| Refactor | `refactor/<scope>` | `refactor/engine-pools` |
| Chore | `chore/<scope>` | `chore/ci-pin-actions` |
| Docs | `docs/<scope>` | `docs/adr-0007` |

```bash
git checkout main
git pull origin main
git checkout -b docs/adr-0007
```

## Commit convention

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

<optional body>

<optional footer, e.g. BREAKING CHANGE: ... or Refs #12>
```

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `build`, `ci`,
`revert`.

**Scopes** (this project):

| Scope | Covers |
|---|---|
| `design` | The Game Design Document and its annexes |
| `adr` | Architecture Decision Records |
| `uml` | UML diagrams under `docs/architecture/diagrams/` |
| `docs` | Any other documentation |
| `ci` | GitHub Actions workflows and CI configuration |
| `repo` | Root configuration and tooling |
| `engine` | Game loop, ports, object pools |
| `game` | Domain rules (player, enemies, bosses, scoring) |
| `render` | Canvas 2D renderer and render adapters |
| `audio` | Audio adapters and SFX / music wiring |
| `input` | Input adapters and intent mapping |
| `ui` | Screens, HUD, options |
| `levels` | Level scripts |
| `assets` | Sprites, music, sound effects under `public/assets/` |
| `i18n` | Message catalogues (EN, FR) |
| `tests` | Test infrastructure and shared fixtures |

The scopes from `engine` onwards exist for the code phase; use them only once the matching code
exists.

Examples:

```
docs(adr): ADR-0008 choose the sprite atlas format
feat(uml): add class diagram for the enemy composition model
fix(design): correct the chain multiplier step table
chore(repo): add .editorconfig
```

## Design before code

The order is fixed and is the project's first non-negotiable:

1. The feature's rules exist in the [GDD](docs/design/game-design-document.md).
2. Its UML diagrams (use case, sequence, component, class, state, data flow — as relevant) are
   written in Mermaid under `docs/architecture/diagrams/<feature>/` and validated.
3. Only then is the feature implemented. The diagrams are the contract the code must satisfy.

Validated decisions are never reopened silently. The GDD decision record and the ADRs list what
was chosen and what was rejected; changing one is an explicit act:

- **Design change** — open a `docs/design-<topic>` branch, revise the GDD in its own PR, update
  the decision record (what changes, what is now rejected, why) and bump the GDD version line.
- **Technical decision** — write a new ADR in `docs/decisions/ADR-NNNN-<slug>.md` using the
  Nygard format (Title, Status, Context, Decision, Consequences). To change an existing decision,
  write a new ADR that supersedes it and set the old one's status to *Superseded by ADR-NNNN*.
  Never edit the body of an accepted ADR.

Both go through the normal PR process below.

## Labels

Every issue and PR carries the triptych:

- one `type:*` — `feature`, `bug`, `refactor`, `chore`, `docs`, `test`, `task`, `epic`;
- one `area:*` — `design`, `uml`, `engine`, `game`, `render`, `audio`, `input`, `ui`, `levels`,
  `assets`, `ci`, `docs`;
- one `priority:*` — `high`, `medium`, `low`.

Extra labels are allowed but never replace the triptych.

## Quality gate — local first

The blocking checks run on the developer's machine, before the push, as decided in
[ADR-0007](docs/decisions/ADR-0007-local-first-quality-gate-minimal-ci.md). Once application code
`pnpm install` installs the git hooks (husky):

| Hook | Runs | Budget |
|---|---|---|
| `pre-commit` | `gitleaks git --pre-commit --staged`, then lint-staged: ESLint and `prettier --check` on the staged files | under 3 s |
| `commit-msg` | commitlint: Conventional Commits with a scope from the project list | instant |
| `pre-push` (`make verify`) | typecheck (app, node and domain projects), lint, format check, Vitest with coverage, `gitleaks git` on the full history, `pnpm audit --audit-level high`, `sonar-scanner` against the local SonarQube (`localhost:9000`) with quality-gate wait | under 90 s |

`make verify` checks the working tree: push from a clean tree, so what is verified is what is
pushed.

Before every push, also run the structured local review gate (`review-local`) and, when render,
input or bootstrap code changed, the Playwright smoke test (`make smoke`).

CI keeps the necessary minimum (ADR-0013): `ci.yml` (lint, typecheck, format check, tests,
build) and the security workflows (Gitleaks, CodeQL, Dependency Review; OSSF Scorecard weekly,
non-blocking). Nothing heavier runs in CI.

When `make verify` cannot pass for a reason outside the change (ADR-0013):

- **SonarQube or the npm registry is unreachable** — push with `git push --no-verify` only after
  the rest of `make verify` passed, and say so in the PR;
- **a high advisory has no fix yet** in a dependency — suppress it with
  `pnpm audit --ignore <GHSA-id>` and log the advisory, the reason and a review date in
  `PROJECT_LOG.md`; never ignore an advisory reachable from the shipped bundle.

The SonarQube analysis token lives in `~/.config/sonar-tokens/retro-shmup` (mode 600) and is
never committed. Never run the scanner in debug mode (`-X`, `sonar.verbose`, `sonar.log.level=DEBUG`):
it prints every property, the token included.

## Pull request process

1. Branch from `main` as above; keep the PR focused on one change.
2. Run the local quality gate and the local review gate before pushing; push only once every
   blocking finding is resolved.
3. Open the PR with the repository template filled in, the labels triptych applied, and a
   Conventional Commit title.
4. All checks must be green: Gitleaks now; the light `ci.yml` once code exists; CodeQL and
   Dependency review once the repository is public.
5. Address every review comment, including automated ones, with an inline reply.
6. The owner merges. Squash or merge is the owner's call; the resulting commit message must stay a
   valid Conventional Commit.

After every merge, add an entry to [PROJECT_LOG.md](PROJECT_LOG.md): date, what was done, why, and
the PR number. The log is the human-readable companion of `git log`, not the release changelog.

## Contributing assets

Sprites, music and sound effects are not covered by the MIT licence of the code (ADR-0005). A PR
that adds or replaces an asset must:

- state the asset's licence (CC0, CC-BY, custom) and confirm it allows redistribution in a
  published game;
- add a row to [CREDITS.md](CREDITS.md): pack or file, author, licence, source URL, modifications;
- keep the in-game credits screen in sync with that file.

Assets with an unclear or incompatible licence are not merged.
