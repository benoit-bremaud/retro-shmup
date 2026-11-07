# ADR-0029: Local CI in four tiers, no GitHub workflow

**Status:** Accepted — 2026-11-07. **Partially supersedes ADR-0007** (its local gate table: husky
hooks, `make verify`) **and ADR-0013** (its CI table: `ci.yml`, CodeQL, Dependency review,
Gitleaks, Scorecard). Their local-first principle — the heavy checks run before the push, the
necessary minimum elsewhere — stands and is taken to its end: nothing runs on GitHub. Issue #156.

## Context

- The owner decided on 2026-11-07 that on every project all checks run locally and GitHub Actions
  is reserved for a production deploy triggered by a signed release tag (local-first CI/CD epic,
  benoit-bremaud/agents-skills#210 and #259; skill `local-ci`). Reference implementations merged
  the same day: dock-n-roll #117, ohm-sweet-ohm #73, feedback-widget #165, brasse-bouillon #2350.
- This repository was the account's largest public consumer of Actions minutes: 1 862 minutes
  over October and the first week of November 2026 (GitHub billing; 0 $ net on a public
  repository). Measured per job, rounded up to the minute as GitHub bills: CodeQL 857 (46 %, a
  two-language matrix fired on every pull request and again on every push to `main`), Gitleaks
  315, CI 305, Dependency review 193, Scorecard 118 (it ran on every push to `main`, not only
  weekly), Dependabot 67. Two root causes: 129 pull requests in five weeks, each firing five jobs
  at the PR and four more at the merge, and CodeQL's weight. No long build: the CI job took about
  a minute.
- Every GitHub check already had a local equivalent or a free open-source one: `make verify`
  covered lint, typecheck, tests, coverage, `pnpm audit` and SonarQube (ADR-0007, ADR-0013);
  gitleaks runs locally in 0.5 s over the full history; Semgrep Community Edition replaces CodeQL
  (the CodeQL CLI licence is limited to public repositories and the owner's rule is free
  open-source tools only); `pnpm audit` already covered what Dependency review did on changed
  dependencies, on the whole lockfile.
- Nothing deploys through Actions: Cloudflare Pages builds `main` and the pull-request previews
  through its own GitHub App (ADR-0004, ADR-0016), and a release is a signed tag (ADR-0025). The
  itch.io release is not wired yet (version 0.0.0).
- `main` is protected with required status checks that were the removed workflows' jobs
  (`.github/branch-protection.md`).

## Decision

1. **Four local tiers, one `just` recipe each** (skill `local-ci`), tools pinned in `mise.toml`
   with `mise.lock`, hooks by lefthook (`just setup` installs both; `mise x -- just <tier>` when
   the shell does not activate mise):

   | Tier | Recipe | Trigger | Holds | Budget |
   |---|---|---|---|---|
   | L0 | `just fast` | lefthook `pre-commit`, `commit-msg` | gitleaks on the staged files, ESLint and Prettier on the staged files, shellcheck on staged scripts; Conventional Commit subject (`scripts/check-commit-msg.sh`) | < 10 s |
   | L1 | `just check` | lefthook `pre-push` (clean tree required), `review-local --push` | `lint` (tsc on the four projects, ESLint, knip, Prettier, shellcheck, `lefthook validate`), `test` (Vitest with the coverage floor, doc coverage ≥ 90 %, the wiring tests `test-local-ci.sh` and `test-attest.sh`), `security` (Semgrep CE `p/javascript` + `p/typescript` on `src`, `tests`, `scripts`; `pnpm audit --audit-level high`), `secrets` (gitleaks, full history) | < 3 min |
   | L2 | `just gate` | `review-local` § 2b on the pushed head, before every merge | refuses a dirty tree, a HEAD behind the base or unpushed; `check`, then `sonar` (local SonarQube with quality-gate wait, coverage report fresher than the sources, server up), then `smoke` (`pnpm test:smoke`: production build and the browser smoke test in Chromium, Firefox and WebKit, ADR-0026); then the attestation | 5–15 min |
   | L3 | `just nightly` | systemd user timer `retro-shmup-nightly` (04:50, persistent) | `check`, TruffleHog over the history (offline), `mise outdated` drift on the pinned tools | none |

2. **The gate is attested** (agents-skills ADR-0003): `just gate` ends with `scripts/attest.sh
   write gate`, a signed git note on `refs/notes/gate` (`gate <owner/repo> <sha>`, SSH signature,
   namespace `local-ci`) pushed to the remote, then the commit status `gate` = success. The trust
   store is `.github/allowed_signers`, read from `origin/main`. **`just merge <pr>`** verifies
   both on the PR's exact head SHA and merges with `gh pr merge --squash --match-head-commit`.

3. **No GitHub workflow.** `ci.yml`, `codeql.yml`, `dependency-review.yml`, `gitleaks.yml` and
   `scorecard.yml` are deleted; `.github/workflows/` stays empty and the wiring test fails if a
   workflow reappears. Dependabot keeps its `npm` block only. Owner MCDA of 2026-11-07:
   Scorecard removed (440/500) over a `scorecard` CLI in `nightly` (340) and the weekly workflow
   kept (240) — a hygiene score computed without GitHub-side CI or SAST would mislead; no
   tag-triggered `prod.yml` (485/500) over an itch.io butler workflow (180) and a Cloudflare
   deploy through wrangler (150) — nothing deploys through Actions. An itch.io workflow arrives
   with the first itch.io release, per skill `release-tag`.

4. **Branch protection** of `main` requires the single status check `gate` (strict), in place of
   the five workflow jobs; pull request required, no force push, no deletion, administrators
   included, unchanged.

5. **Removed**: `Makefile`, husky, lint-staged, commitlint and its config. `make verify` is
   `just check`, `make smoke` is `just smoke`, `make sonar-scan` is `just sonar`. The doc
   coverage measure moves from the Makefile to `scripts/doc-coverage.sh`.

6. **Not installed, on purpose** (skill rule 1, scope the tiers to the real stack): typos (the
   FR message catalogue and the country table are not English text), osv-scanner and Trivy
   (`pnpm audit` audits the lockfile; no Dockerfile), actionlint and zizmor (no workflow).

## Alternatives considered

- **Keep `ci.yml` as a light server-side safety net** (ADR-0007's reason: a `--no-verify` push
  would still be caught) — rejected: the attestation replaces it; a head without a verified
  `gate` note cannot be merged, whatever was skipped locally, and the protection requires it.
- **Keep Gitleaks on GitHub as defence in depth** — rejected: the same binary runs in L0, L1 and
  the nightly; the server-side copy added a billed minute per push for a 10 s scan.
- **Keep CodeQL** (free on a public repository) — rejected: 46 % of the minutes, and Semgrep CE
  gives a SAST pass in the pre-push tier, before the push rather than minutes after.
- **A self-hosted runner** — rejected again (ADR-0007): it keeps the GitHub dependency and the
  round trip for no check the local tiers do not run.

## Consequences

- Zero Actions minutes; feedback at commit and push time instead of after the push.
- `main` cannot be merged without a gate attested on the exact head: the merge path is
  `just merge <pr>` after `just gate` on the pushed head (`review-local`). A squash creates a new
  `main` commit without attestation; Cloudflare Pages deploys it regardless (ADR-0016), so the
  gate protects what enters `main`, not the deploy itself — unchanged from today.
- First merge (bootstrap): `.github/allowed_signers` is not on `main` yet when this ADR's PR is
  gated, so `attest.sh verify` cannot find the trust store; the PR merges through `gh pr merge`
  with the owner's explicit waiver, and every later merge goes through `just merge`.
- The Security tab loses the CodeQL and Scorecard reports; Dependabot alerts stay.
- Contributors need mise (`curl https://mise.run | sh`), then `just setup`; `sonar-scanner` and
  the Playwright browsers stay system tools (CONTRIBUTING.md).
- The owner's main checkout must `git pull` and run `just setup` after the merge: its husky hook
  path was unset by this change.

## References

- Skill `local-ci` (tiers, attestation, templates); agents-skills ADR-0003 (attestation),
  ADR-0004 (prod from signed tags), #210, #259.
- ADR-0004, ADR-0016 (Cloudflare Pages builds `main`), ADR-0025 (signed tags), ADR-0026 (smoke).
- Issue #156 (minutes table and MCDA records).
