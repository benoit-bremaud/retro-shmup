# ADR-0007: Local-first quality gate, minimal CI

**Status:** Accepted — 2026-10-07

## Context

The project is developed by a single person on one machine that already runs a shared
**SonarQube Community Build** instance (`http://localhost:9000`, version 26.5) with `sonar-scanner`
installed. That edition analyses the main branch only and does not decorate pull requests, which
rules out PR-time cloud analysis but fits a workflow where quality is checked **before** a push
rather than after it.

The owner's rule for this repository: run as many checks as possible locally and keep only what is
necessary in GitHub Actions. Three facts shape "necessary":

1. `main` is protected and requires status checks (ADR-0004, `.github/branch-protection.md`), so
   at least one check must exist server-side.
2. A git hook is a convenience, not a guarantee: `git push --no-verify` skips it. Secret detection
   therefore needs a server-side copy (defence in depth, per the owner's security baseline).
3. On a private repository without GitHub Advanced Security, CodeQL and Dependency Review cannot
   run; both become free once the repository is public.

The repository is hosted on the personal account `benoit-bremaud` (not the StudioB22
organisation, whose plan is also Free and where `gitleaks-action` would require a licence key).

## Decision

### Local gate (blocking, installed by `pnpm install` through husky)

| Hook / command | Steps | Budget |
|---|---|---|
| `pre-commit` | `gitleaks protect --staged --redact`; ESLint + Prettier on staged files | < 3 s |
| `pre-push` = `make verify` | typecheck → Vitest (unit + headless level simulation) with coverage → `gitleaks detect` on the pushed range → `sonar-scanner` against `localhost:9000` with `-Dsonar.qualitygate.wait=true` | < 90 s |
| manual, before push | `review-local` (structured agentic review, mandatory per the owner's global rules); `make smoke` (Playwright browser smoke test) whenever render, input or bootstrap code changed | — |

- SonarQube project key `retro-shmup`; `sonar-project.properties` is committed **without** any
  token; the project analysis token lives in `~/.config/sonar-tokens/retro-shmup` (mode 600),
  never in the repository nor in GitHub secrets (no CI job uses it).
- The quality gate starts as SonarQube's default "Sonar way" (new-code coverage, duplication,
  reliability/security/maintainability ratings); tightening it is a later, explicit decision.
- Because Community Build has a single main-branch analysis slot, the instance reflects the
  **last pushed working tree**. For a solo developer this is accepted; the next push refreshes it.

### CI (GitHub Actions) — the necessary minimum

| Workflow | State | Role |
|---|---|---|
| `gitleaks.yml` | active (push `main`, PR, weekly) | server-side secret detection; required check |
| `ci.yml` | added with the vertical slice | lint + typecheck + tests, no coverage upload, no Sonar; required check (~1 min) |
| `codeql.yml`, `dependency-review.yml` | dormant (`workflow_dispatch`) | activated by PR once the repository is public and TypeScript code exists |

No SonarCloud, no coverage service, no end-to-end test and no self-hosted runner in CI.

## Alternatives considered

- **SonarCloud with PR decoration** — rejected: moves the heaviest analysis to the cloud, needs a
  cloud token in CI (the owner's token leaked twice in the past on another project), and the
  self-hosted instance already exists.
- **SonarQube in CI through the colocated self-hosted runner** — rejected: a runner for other
  projects exists on this machine, but it keeps heavy work in CI and makes every PR depend on the
  developer's machine being up; the local hook gives the same verdict earlier.
- **Manual `make verify` only, no hooks** — rejected: relies on discipline; hooks make the gate
  the default and keep `--no-verify` a conscious, visible exception.
- **Full CI (coverage artefacts, E2E, Scorecard)** — rejected: contrary to the owner's rule, slower
  feedback, no additional safety beyond the local gate plus the two server-side checks.

## Consequences

- Fast feedback: a failing test or a red quality gate is known before the push, not ten minutes
  after.
- Two server-side checks keep `main` protected even when a hook is bypassed; a `--no-verify` push
  that breaks tests is caught by `ci.yml`.
- The local gate depends on the SonarQube container running; `make verify` must fail clearly (not
  hang) when `localhost:9000` is down, and the developer may push with `--no-verify` only after
  running the rest of the gate — this is documented in `CONTRIBUTING.md`.
- Follow-ups at vertical-slice time: `Makefile` (`verify`, `smoke`, `sonar-scan`), husky hooks,
  `sonar-project.properties`, SonarQube project + token provisioning, `ci.yml`, and a PR-template
  checkbox "`make verify` passed locally".
- CodeQL and Dependency Review activation is a one-line trigger change, tracked as a follow-up of
  the public switch.

## References

- GDD §13 "Technical constraints"; ADR-0003 (test strategy), ADR-0004 (delivery).
- Owner conventions: `~/.agent-rules/common.md` § Pre-push review gate; security CI baseline
  (Gitleaks mandatory and blocking).
- SonarQube Community Build: main-branch-only analysis, no PR decoration (edition comparison in
  the SonarSource documentation).
- `gitleaks protect` / `gitleaks detect` — gitleaks documentation; `gitleaks-action` README
  (licence key required for organisations only).
- husky — git hooks managed through `package.json` scripts.
