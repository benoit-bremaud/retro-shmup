# Local review — retro-shmup (branch `ci/activate-public-security-scans`)

- Date: 2026-10-08
- Commit: `46aab98` + working tree (5 files)
- Scope: branch diff `main...HEAD` plus uncommitted changes — two workflows, branch-protection
  documentation, `CLAUDE.md`, `PROJECT_LOG.md`
- Checks run: security · correctness · docs. Design and tests: not applicable (no application
  code and no test in the change; the design phase has none yet).
- Verdict: **ship** · Must 0 · Should 1 · Nice 1

## 🔴 Must Have

_None._

## 🟡 Should Have

- `PROJECT_LOG.md:9` `[docs]` · The 2026-10-08 entry does not name the pull request that carries
  it, while the project-log discipline asks for the PR number and merge SHA. · Add the PR number
  once the PR is opened and the merge SHA after merge (follow-up log update).

## 🔵 Nice to Have

- `.github/branch-protection.md:15` `[docs]` · "the gate he can satisfy" uses a gendered pronoun
  for the owner. · Rephrase as "the owner is bound by a gate they can satisfy".

## ⚪ Disagree / Intentional

- `.github/workflows/codeql.yml:28` `[correctness]` · CodeQL is activated before any TypeScript
  exists, while ADR-0007's CI table says "once the repository is public and TypeScript code
  exists". · Intentional: the matrix uses the `actions` language, which has real sources today
  (the workflows), so the check is meaningful and cannot fail for lack of code; recorded as a
  decision in `PROJECT_LOG.md` (2026-10-08). ADR bodies are not edited (CLAUDE.md).
- `.github/workflows/dependency-review.yml:5` `[correctness]` · Runs on pull requests although no
  package manifest exists yet. · Intentional: the action passes when the dependency graph has no
  change; it becomes a real gate with the vertical slice's `package.json` without another PR.

## Per-dimension summary

- Design: not applicable (configuration and documentation only).
- Docs: consistent with the applied GitHub settings; one missing PR reference, one pronoun.
- Tests: not applicable (no code, no test).
- Security: both workflows keep least-privilege permissions (`contents: read`, plus
  `security-events: write` and `actions: read` for CodeQL only), checkout with
  `persist-credentials: false`, every action pinned by full SHA; no secret introduced.
- Correctness: trigger blocks valid YAML; required-check names (`Secret scan`,
  `Analyze (actions)`, `Dependency review`) match the job names; they are added to the `main`
  protection only after this PR has run them green, so the protection cannot reference a check
  that never reported.
