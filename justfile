# Local CI (#156, skill local-ci, ADR-0029): four tiers, one recipe each, no GitHub and no AI agent
# needed. GitHub Actions runs nothing: Cloudflare Pages builds `main` through its own GitHub App
# (ADR-0004, ADR-0016) and a release is a signed tag (ADR-0025). Tools come from mise.toml
# (`just setup`); run through `mise x -- just <tier>` when the shell does not activate mise (the
# git hooks do).
#
#   L0 fast     pre-commit hook                        staged files only                       < 10 s
#   L1 check    pre-push hook, review-local --push     lint + test + security + secrets        < 3 min
#   L2 gate     review-local § 2b, on the pushed head  check + Sonar + browser smoke,          5–15 min
#               before every merge                     then the attestation
#   L3 nightly  systemd user timer                     check + TruffleHog + toolchain drift
#
# Then: `just merge <pr>` (refuses without the gate attestation on the head SHA).

set shell := ["sh", "-eu", "-c"]

# L1 by default
default: check

# Once per clone: the pinned toolchain, the dependencies and the git hooks
setup:
    mise install
    mise x -- pnpm install --frozen-lockfile
    mise x -- lefthook install

# L0 — the pre-commit checks on the staged files (< 10 s)
fast:
    lefthook run pre-commit

# Fail fast outside the .nvmrc Node major: an nvm or system Node in a non-interactive shell would
# run the whole suite on the wrong runtime. Fix: `mise x -- just <recipe>`.
[private]
node-guard:
    @node -e 'const want=require("fs").readFileSync(".nvmrc","utf8").trim().split(".")[0]; const v=process.versions.node; if (v.split(".")[0] !== want) { console.error("Node " + v + " found, Node " + want + " required (.nvmrc). Run: mise x -- just <recipe>"); process.exit(1) }'

# tsc (app, node, smoke and domain projects), eslint, knip, prettier, the shell scripts, the hooks
lint: node-guard
    pnpm typecheck
    pnpm lint
    pnpm knip
    pnpm format:check
    shellcheck --severity=warning scripts/*.sh
    lefthook validate

# Vitest with the coverage floor of vitest.config.ts, doc coverage >= 90 %, the local CI wiring tests
test: node-guard
    pnpm test:coverage
    sh scripts/doc-coverage.sh
    sh scripts/test-local-ci.sh
    sh scripts/test-attest.sh

# SAST (Semgrep Community Edition, named registry rulesets: `--config auto` would send the project
# URL; no p/secrets, which prints the matched value, gitleaks redacts it) on the game, its tests and
# the scripts, then known vulnerabilities in every dependency, dev ones included, HIGH and above
# (ADR-0013; replaces CodeQL and Dependency review). EIO_BACKEND=posix: semgrep-core otherwise opens
# io_uring rings charged to RLIMIT_MEMLOCK with every Electron process, and dies intermittently.
# SAST (Semgrep CE on src, tests, scripts) + pnpm audit HIGH and above
security:
    EIO_BACKEND=posix semgrep scan --config p/javascript --config p/typescript --error --metrics=off --quiet -j 4 src tests scripts
    pnpm audit --audit-level high

# Secrets in the whole git history (replaces the gitleaks workflow)
secrets:
    gitleaks git --redact --no-banner .

# L1 — pre-push (< 3 min)
check: lint test security secrets

# L2 — pre-merge, called by review-local § 2b (base: the branch to integrate into), 5–15 min.
# Ends with the gate attestation (agents-skills ADR-0003): commit status `gate` + signed note on
# HEAD, which must already be pushed and up to date with `base`, so it runs on the pushed head only;
# the clean-tree and pushed checks run first, not after 10 minutes in `attest.sh write`.
# L2 — pre-merge on the pushed head: check + Sonar + browser smoke, then the attestation (5–15 min)
gate base="origin/main":
    #!/bin/sh
    set -eu
    base={{quote(base)}}
    [ -z "$(git status --porcelain)" ] || { echo "gate: commit or set aside local changes first" >&2; exit 1; }
    case "$base" in origin/*) git fetch --quiet origin "${base#origin/}" ;; esac
    git merge-base --is-ancestor "$base" HEAD || { echo "gate: HEAD is behind $base, merge or rebase it first" >&2; exit 1; }
    [ -n "$(git branch -r --contains HEAD)" ] || { echo "gate: push HEAD first (the attestation is written on the pushed head)" >&2; exit 1; }
    # `check` runs from the body, not as a dependency, so the HEAD it checked is the one attested.
    start=$(git rev-parse HEAD)
    just check
    just sonar
    just smoke
    [ "$(git rev-parse HEAD)" = "$start" ] || { echo "gate: HEAD moved during the gate ($start checked), run it again" >&2; exit 1; }
    sh scripts/attest.sh write gate

# SonarQube analysis on the local Community Build (ADR-0007) with the project token of
# ~/.config/sonar-tokens/retro-shmup (CONTRIBUTING.md), waiting for the quality gate. It uploads
# coverage/lcov.info, so it refuses a report older than the sources: `just test` writes it first.
# SonarQube analysis with quality-gate wait (step of gate)
sonar:
    #!/bin/sh
    set -eu
    command -v sonar-scanner > /dev/null || { echo "sonar: sonar-scanner not on PATH (system tool, skill local-ci rule 2)" >&2; exit 1; }
    [ -f coverage/lcov.info ] || { echo "sonar: run just test first (coverage/lcov.info missing)" >&2; exit 1; }
    stale=$(find src -newer coverage/lcov.info -type f -print -quit)
    [ -z "$stale" ] || { echo "sonar: coverage/lcov.info is older than $stale; run just test" >&2; exit 1; }
    SONAR_TOKEN="${SONAR_TOKEN:-$(cat "$HOME/.config/sonar-tokens/retro-shmup" 2>/dev/null || true)}"
    [ -n "$SONAR_TOKEN" ] || { echo "sonar: no token in SONAR_TOKEN or ~/.config/sonar-tokens/retro-shmup" >&2; exit 1; }
    url="${SONAR_HOST_URL:-http://localhost:9000}"
    curl -sf -m 5 "$url/api/system/status" | grep -q '"status":"UP"' || { echo "sonar: SonarQube is not UP at $url, start it first (ADR-0013)" >&2; exit 1; }
    SONAR_TOKEN="$SONAR_TOKEN" sonar-scanner -Dsonar.host.url="$url" -Dsonar.projectVersion="$(node -p "require('./package.json').version")" -Dsonar.qualitygate.wait=true

# The single browser smoke test (ADR-0003) against the production build, in Chromium, Firefox and
# WebKit (ADR-0026): `pnpm test:smoke` builds first. Step of gate, not of check.
# Build the bundle and run the browser smoke test in the three engines (step of gate)
smoke: node-guard
    pnpm test:smoke

# Merge a PR only when its exact head SHA carries the gate attestation (agents-skills ADR-0003).
# Squash, as every merge of this repository.
merge pr:
    #!/bin/sh
    set -eu
    pr={{quote(pr)}}
    case "$pr" in ''|*[!0-9]*) echo "merge: usage just merge <pr number>" >&2; exit 1 ;; esac
    sha=$(gh pr view "$pr" --json headRefOid -q .headRefOid)
    git fetch --quiet origin "$sha"
    sh scripts/attest.sh verify gate "$sha"
    gh pr merge "$pr" --squash --match-head-commit "$sha"

# L3 — nightly, systemd user timer (no time budget): deep secret history (TruffleHog, offline;
# .trufflehog-exclude lists itself, its wording trips the URI detector) and toolchain drift:
# `mise outdated` exits 0 whatever it finds and still lists the global ~/.tool-versions under
# --no-global, so the recipe keeps the mise.toml rows and fails on a non-empty report (`--bump`:
# without it exact pins report nothing; Node and pnpm follow .nvmrc and package.json on purpose).
# L3 — nightly (systemd timer): check + TruffleHog + toolchain drift
nightly: check
    trufflehog git "file://$PWD" --no-verification --fail --no-update --exclude-paths .trufflehog-exclude
    out=$(mise outdated --bump --no-global --no-header) || { echo "nightly: mise outdated failed" >&2; exit 1; }; \
    drift=$(printf '%s\n' "$out" | grep -F mise.toml | grep -vE '^(node|pnpm) ' || true); \
    [ -z "$drift" ] || { echo "nightly: toolchain drift, bump mise.toml:"; echo "$drift"; exit 1; }
