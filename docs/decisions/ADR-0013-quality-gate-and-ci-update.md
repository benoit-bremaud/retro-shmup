# ADR-0013: Quality gate and CI after going public — Scorecard, CodeQL, audit

**Status:** Accepted — 2026-10-08. **Partially supersedes ADR-0007**: its CI table and its
rejection of OSSF Scorecard; its local-gate principle (heavy checks before the push, minimum in
CI) stands.

## Context

- ADR-0007 (2026-10-07) was written for a private repository: CodeQL and Dependency Review were
  dormant for lack of GitHub Advanced Security, and "Full CI (coverage artefacts, E2E,
  Scorecard)" was rejected.
- The repository went public on 2026-10-08 (PR #1): CodeQL and Dependency Review are free and
  active; CodeQL now covers `javascript-typescript` as well as `actions` (toolchain PR).
- The owner asked that every security skill apply to the code; the owner's security CI baseline
  recommends OSSF Scorecard for public repositories. The owner chose Scorecard **weekly and
  non-blocking** on 2026-10-08.
- The toolchain (ADR-0011) added `pnpm audit --audit-level high` to `make verify`. A dependency
  audit fails when the registry is unreachable and when a high advisory has no fix yet; ADR-0007's
  `--no-verify` exception covered only a SonarQube outage.

## Decision

### CI (replaces ADR-0007's CI table)

| Workflow | Trigger | Required check | Role |
|---|---|---|---|
| `gitleaks.yml` | push `main`, PR, weekly | `Secret scan` | server-side secret detection |
| `ci.yml` | push `main`, PR | `Lint, typecheck, test` | lint, typecheck, format check, tests, build; no coverage upload, no Sonar |
| `codeql.yml` | push `main`, PR, weekly | `Analyze (actions)`, `Analyze (javascript-typescript)` | SAST of the workflows and the game code |
| `dependency-review.yml` | PR | `Dependency review` | blocks high or critical vulnerable dependencies |
| `scorecard.yml` | push `main`, weekly | **none** | OSSF Scorecard: repository hygiene report in the Security tab; never on pull requests, gates nothing |

Still out of CI: SonarCloud, coverage services, end-to-end tests, self-hosted runners.

### Local gate (extends ADR-0007's table)

`make verify` = typecheck, lint, format check, tests with coverage, `gitleaks git` (full
history), `pnpm audit --audit-level high`, SonarQube scan with quality-gate wait (ADR-0011).

When the audit blocks a push:

1. **Registry unreachable** — the same exception as a SonarQube outage: push with `--no-verify`
   only after the rest of `make verify` passed, and say so in the PR.
2. **High advisory with no fix** in a dependency (typically a transitive dev-only one) — add it to
   `auditConfig.ignoreGhsas` with `pnpm audit --ignore <GHSA-id>`, and log the advisory, the
   reason and a review date in `PROJECT_LOG.md`. Never ignore an advisory reachable from the
   shipped bundle.

## Alternatives considered

- **Keep Scorecard rejected (ADR-0007 as is)** — rejected by the owner: a public repository
  benefits from an independent hygiene report, and running it weekly and on `main` only keeps the
  pull-request loop as light as ADR-0007 wanted.
- **Scorecard on pull requests or as a required check** — rejected: it would make the CI heavier
  and block merges on scores that are advisory by nature.
- **No dependency audit locally, Dependency Review only** — rejected: Dependency Review sees only
  the dependencies a pull request changes; the local audit also reports advisories published
  later on dependencies already in the lockfile.

## Consequences

- ADR-0007's principle is unchanged; its tables are read through this ADR.
- The required checks on `main` are those of the CI table above (`.github/branch-protection.md`);
  a new check is added only after it has reported green once.
- Suppressed advisories are visible in `pnpm-workspace.yaml` and the project log, never silent.

## References

- ADR-0007, ADR-0011; PR #1 (public switch); owner's security CI baseline.
- OSSF Scorecard action: https://github.com/ossf/scorecard-action
- pnpm audit: https://pnpm.io/cli/audit
