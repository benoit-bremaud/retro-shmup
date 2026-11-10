# Local review — retro-shmup (#156 local CI)

Pre-push gate (`review-local --push`) on the branch that moves every check to local CI and removes
the GitHub workflows (ADR-0029).

- Date: 2026-11-07
- Commit: `aedd288` reviewed; fixes `9157cff`, `249a104`, `5e40a6f` (all signed)
- Scope: branch diff `origin/main...HEAD` (`ci/156-local-ci-no-workflows`)
- Checks run: adversarial (Opus rounds 1–3, Sonnet round 4) · docs · tests · security · correctness · `just check`
  (design: no application code changed, not run)
- Verdict: fix Must Have first → all fixed by `5e40a6f` · Must 13 (all fixed) · Should 22 (19
  fixed, 3 recorded) · Nice 14 (8 fixed)

## Adversarial review (#236)

- Round 1 on `aedd288`: Must 4 · Should 6 · Nice 6 · unverified 2 · Push gate: closed
- Round 2 on `9157cff`: 4 fixed · 0 not fixed · 1 regressed (Node major pin made the nightly drift
  red) · new Must 2 (drift, CLAUDE.md guard list) · Push gate: closed
- Round 3 on `249a104`: 2 fixed · 0 not fixed · 0 regressed · new Must 0 · Should 1 (guard misses
  tsconfig, vite, prettier config) · Push gate: open
- Round 4 on `5e40a6f` (fresh Sonnet agent: the Opus weekly quota was exhausted; the diff is a
  pathspec, two doc lists, one test case and line wraps): 3 fixed · 0 not fixed · 0 regressed · new
  Must 0 · Nice 1 (test commit message copied from the previous case, left) · Push gate: open
- Hosted reviewers: none (owner rule: no Copilot / Codex on this repository)

## Pre-merge gate (head SHA `5e40a6f`)

| Step | Result |
|---|---|
| 0 CI mirror | n/a — no PR workflow is left (ADR-0029) |
| 1 Tests | ✅ Vitest suites green · ✅ `test-local-ci.sh` 91 cases · ✅ `test-attest.sh` 28 cases |
| 2 Coverage | tests 99.26 % stmts / 95.73 % branches / 100 % funcs / 99.91 % lines (floor 80) · docs 375/377 = 99.5 % (floor 90) |
| 3 SonarQube | ⏸ deferred to the pre-merge run (`just gate`) |
| 4 Secrets | ✅ gitleaks clean on `origin/main..HEAD` and full history · no tracked `.env` · diff read: nothing sensitive (the `AKIA…` string is the L0 test fixture) |
| 5 E2E/smoke | ⏸ deferred to the pre-merge run (`just smoke` inside `just gate`) |
- Gate: `--push`: **pre-push green** — `just check` passed in 60 s from a clean environment (`env -i … mise x -- just check`; L0 `just fast` 0.4–1.6 s), SonarQube and smoke
  deferred (never GREEN here)

## 🔴 Must Have (all fixed in `9157cff`, `249a104`)

- `scripts/check-commit-msg.sh:14` `[adversarial]` · the removed commitlint enforced a mandatory
  scope from an enum; the new hook accepted any or no scope · scope-enum restored (`deps` added for
  Dependabot), CONTRIBUTING aligned, 3 new cases
- `CONTRIBUTING.md:67` `[docs|adversarial]` · listed `style` and `revert`, refused by the hook ·
  type list aligned with the hook
- `justfile` gate/merge `[adversarial|security]` · the gate runs the branch's own recipes and
  scripts with the owner's keys and tokens; `just merge` used the checkout's verifier · gate
  refuses a branch touching `justfile`, `lefthook.yml`, `mise.toml`, `mise.lock`, `scripts/`,
  `.github/allowed_signers` without `GATE_CI_CHANGE=1`; `merge` runs `origin/main:scripts/attest.sh`;
  ADR-0029 consequence + CONTRIBUTING step 4; 3 new cases
- `.github/allowed_signers` bootstrap `[security|adversarial]` · trust store absent from `main`,
  live protection still names deleted workflow jobs · bootstrap order (gate → re-apply protection →
  waived `gh pr merge`) written in ADR-0029 and `branch-protection.md`
- `mise.toml:19` `[security]` · `pipx:semgrep` pins the version, not its Python dependencies ·
  recorded as an accepted gap in ADR-0029 and the file comment
- Stale copies `[docs|adversarial]` · `.gitleaks.toml:10`, `sonar-project.properties:2,11`,
  `.github/pull_request_template.md:5,37`, `CLAUDE.md:111`, `.env.example:10`, `attest.sh` header
  (`just attest staging`, ADR numbers of another repository) · all reworded
- `docs/decisions/ADR-0007|0011|0013` Status `[adversarial|docs]` · not marked superseded ·
  "Partially superseded by ADR-0029" on the three ADRs and the README rows; ADR-0029 names ADR-0011
- `scripts/test-local-ci.sh:132` `[tests]` · gate failure paths untested (failing `check`, `sonar`,
  attestation) · 3 cases + default base
- `scripts/test-local-ci.sh:105` `[tests]` · the sonar stub never failed · `SCANNER_FAIL` case
- `scripts/test-local-ci.sh:167` `[tests]` · `no_line pnpm` could never fail (no stub) · pnpm stub +
  positive node-guard case
- `scripts/toolchain-drift.sh` `[adversarial]` (round 2) · with `node = "22"`, `mise outdated --bump`
  reports the next major every night · two passes: Node patches without `--bump`, exact pins with it
- `CLAUDE.md:111` `[adversarial]` (round 2) · listed other files than the gate guard checks · one
  list in `justfile`, CLAUDE.md and ADR-0029 (19 paths after rounds 3 and 4)
- `scripts/test-attest.sh:16` `[tests]` · the fake `gh` pre-digested the status, hiding the `-q`
  filter · the fake stores JSON and applies the real filter with `jq` (pinned in mise); statuses of
  another context or `failure` refused (2 cases)

## 🟡 Should Have

- Fixed: gate guard extended to `package.json`, the tsconfig, vite, vitest, eslint, knip,
  playwright, prettier and sonar configs and the scanner ignore files `[adversarial]` · `deps`
  scope in CLAUDE.md and the PR template `[adversarial]` · `.nvmrc` back to the major `22`, `mise.toml` `node = "22"` (lock holds the build), drift
  check now flags Node patches `[adversarial|security]` · `attest.sh` option-shaped arguments and
  a named failure on `git notes add` `[security|adversarial]` · `doc-coverage.sh` no-export guard
  and per-file reset `[security]` · `lefthook.yml` prettier glob without `md` `[security]` ·
  `test-local-ci.sh:50` `rc=` pattern `[security]` · pre-push dirty-tree guard asserted
  `[adversarial]` · `mise x -- just setup` and the husky `core.hooksPath` hint in CONTRIBUTING
  `[adversarial]` · `touch -d` instead of `sleep 1`, meaningful token assertion `[tests]` ·
  `GIT_CONFIG_GLOBAL` in `test-attest.sh`, foreign-signed tag and regex edges `[tests]` · gh
  failure propagation in `merge` `[tests]` · nightly drift logic extracted to
  `scripts/toolchain-drift.sh` with 5 cases `[tests]` · `just fast` vs `commit-msg` wording, `ci`
  scope, branch example, pipx prerequisite, rewraps `[docs]` · GDD status v0.33 for the decision
  record row `[docs]`
- Recorded, not changed: the `gate` status alone is forgeable, the signed note is the control,
  merges go through `just merge` only (`branch-protection.md`, ADR-0029) `[security]` ·
  Cloudflare Pages `NODE_VERSION=22.23.3` set in its dashboard, same major, to bump by the owner
  `[security]` · ADR and implementation in one PR (precedent #4 bundled ADR-0011/0013) — owner's
  call, kept `[adversarial]`

## 🔵 Nice to Have

- Fixed: Semgrep no longer scans `scripts/` (shell, shellcheck's) `[adversarial]` ·
  `.env.example` Actions wording `[adversarial]` · ADR-0029 "stays empty" wording `[adversarial]`
  · `test-local-ci.sh` deps grep, same-repo PR comment on `merge` `[security]`
- Left: duplicated `just --list` summary lines (deliberate, `just --list` prints the last comment)
  `[adversarial|docs]` · 8 "recipe exists" cases inflate the count `[tests]` · systemd units
  untested `[tests]` · Sonar scan on a branch overwrites the main analysis (pre-existing)
  `[adversarial]` · nightly timer fails each night until the merge lands in the main checkout
  `[adversarial]`

## ⚪ Disagree / Intentional

- `justfile` `nightly: check` as a dependency, `gate` running `check` from its body · nightly
  attests nothing, gate must attest the HEAD it checked `[adversarial]`
- `scripts/test-local-ci.sh:37` stubbed `just` on PATH for the gate steps · the real recipe runs,
  only the delegated steps are doubles `[tests]`

## Per-dimension summary

- Adversarial: 4 Must in round 1 (scope enum, stale copies, ADR statuses, branch supplies its own
  verifier), 2 in round 2 (nightly drift, guard list), all fixed; round 3 and 4 open · Docs: 5 stale references fixed, tier wording aligned · Tests: 5 false-confidence or
  untested failure paths fixed, 91 + 28 cases now · Security: bootstrap and pipx gap recorded,
  argument guards added · Correctness: `just check` green from a clean environment.
