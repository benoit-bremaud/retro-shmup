#!/bin/sh
# Tests for the local CI wiring (#156, skill local-ci rule 7): the four tiers exist and compose
# (check = lint + test + security + secrets; nightly ⊇ check), no GitHub workflow is left (ADR-0029),
# the Node major and pnpm pins agree, lefthook.yml is valid and wires the commit-msg and pre-push hooks,
# the commit-msg check accepts and refuses the right subjects; then, in a throwaway repository with
# stubbed boundaries (just steps, attest.sh, gh, sonar-scanner): gate refuses a dirty tree, a HEAD
# behind the base or unpushed, runs check → sonar → smoke → attestation in that order, stops at the
# first failing step and attests nothing when a step fails or HEAD moved, and propagates a failed
# attestation (agents-skills ADR-0003); merge refuses a non-numeric PR and a head without attestation,
# merges with --squash --match-head-commit and propagates a gh failure; sonar refuses a missing or
# stale coverage report and a missing token, and a failed quality gate fails it; toolchain-drift
# fails on a Node patch or an exact pin behind, not on a Node major; node-guard refuses the wrong Node major and passes the right one; L0
# (`just fast`) passes a clean staged change but refuses a staged secret and a shell warning.
# Needs mise, just, lefthook, gitleaks, shellcheck (the tool wordings asserted are pinned by
# mise.lock):
#   mise x -- sh scripts/test-local-ci.sh
set -e
# A hook (pre-push runs `just check`) exports these; they would aim git at the outer repository.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_OBJECT_DIRECTORY GIT_COMMON_DIR
# The gate of a branch that changes the local CI runs with GATE_CI_CHANGE=1; the guard cases
# below must not inherit it.
unset GATE_CI_CHANGE
# The throwaway repositories must not inherit the machine's signing, hooks or URL rewrites.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
# The L0 hooks run `mise x --` in the throwaway repo, which records a trust entry for its path: drop it.
trap 'rm -f "${MISE_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/mise}"/trusted-configs/*"$(basename "$work")"*; rm -rf "$work"' EXIT
n=0
fail() { echo "FAIL $1"; exit 1; }

# `mise x --` puts the tools on PATH but not mise itself (hooks and the throwaway repo need it).
command -v mise > /dev/null || { [ -x "$HOME/.local/bin/mise" ] && PATH="$HOME/.local/bin:$PATH" && export PATH || true; }
for bin in mise just lefthook gitleaks shellcheck; do
  command -v "$bin" > /dev/null || fail "$bin not on PATH"
done

# Tiers and their composition.
cd "$root"
ok() { n=$((n + 1)); }
for r in fast check gate nightly setup merge smoke sonar; do
  just --show "$r" > /dev/null 2>&1 || fail "recipe $r missing"; ok
done
deps() { just --show "$1" | grep -E "^$1( |:)" | sed 's/.*: *//'; } # deps <recipe>
[ "$(deps check)" = "lint test security secrets" ] || fail "check must be exactly lint test security secrets"; ok
deps nightly | grep -qw check || fail "nightly does not depend on check"; ok
just --show smoke | grep -q 'pnpm test:smoke' || fail "smoke does not run the browser smoke test (ADR-0026)"; ok
just --show test | grep -q 'scripts/doc-coverage.sh' || fail "test does not measure the doc coverage"; ok
[ -z "$(find .github -path '*/workflows/*' -name '*.y*ml' 2>/dev/null)" ] || fail "a GitHub workflow is left (ADR-0029: none)"; ok
# The nightly TruffleHog exclude list: every rule is a valid regex, and the file excludes itself (its
# own wording trips the URI detector once committed).
just --show nightly | grep -q -- '--exclude-paths .trufflehog-exclude' || fail "nightly does not pass .trufflehog-exclude to trufflehog"; ok
grep -v '^#' .trufflehog-exclude | grep -v '^$' | while IFS= read -r re; do
  rc=0; printf '' | grep -Eq -- "$re" 2>/dev/null || rc=$?; [ "$rc" -le 1 ] || fail ".trufflehog-exclude: invalid regex: $re"
done || exit 1; ok
grep -qxF -- '^\.trufflehog-exclude$' .trufflehog-exclude || fail ".trufflehog-exclude does not exclude itself"; ok
# The Node major and the pnpm version are each written in two places; they must agree.
v=$(cat .nvmrc)
grep -qE "^node = \"$v(\.|\")" mise.toml || fail "Node pin of mise.toml diverges from .nvmrc ($v)"; ok
pv=$(sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' package.json)
grep -qF "pnpm = \"$pv\"" mise.toml || fail "pnpm pin of mise.toml diverges from package.json ($pv)"; ok
grep -qE '^ +run: sh scripts/check-commit-msg.sh \{1\}' lefthook.yml || fail "commit-msg hook does not run check-commit-msg.sh on the message file"; ok
grep -qE '^ +mise x -- just check$' lefthook.yml || fail "pre-push hook does not run just check"; ok
grep -qF 'git status --porcelain' lefthook.yml || fail "pre-push hook does not refuse a dirty tree"; ok
lefthook validate > /dev/null || fail "lefthook validate"; ok

# commit-msg subjects.
msg() { # msg <expected-exit> <subject>
  printf '%s\n' "$2" > "$work/msg"
  rc=0; sh scripts/check-commit-msg.sh "$work/msg" > /dev/null 2>&1 || rc=$?
  [ "$rc" -eq "$1" ] || fail "commit-msg '$2': exit $rc, expected $1"; ok
}
msg 0 'ci(repo): move every check to local CI'
msg 1 'feat: no scope'
msg 1 'feat(nonsense): scope outside CONTRIBUTING'
msg 0 'feat(game)!: the chain breaks on a miss'
msg 0 'Merge branch main into feat/1'
msg 0 'fixup! feat: x'
msg 1 'Wire just'
msg 1 'ci(repo): ends with a period.'
msg 1 'wip(repo): not a listed type'
msg 0 "feat(game): $(printf 'x%.0s' $(seq 88))" # exactly 100 characters
msg 1 "feat(game): $(printf 'x%.0s' $(seq 89))" # 101
msg 1 ''
msg 0 'Revert "feat: x"'
msg 1 'feat(Game): uppercase scope'

# Recipes with their boundaries stubbed, in a throwaway repository with a bare origin. The real
# `just` runs the recipe; a stub `just` first on PATH records the steps the recipe delegates to
# (check, sonar, smoke) and fails the one named in FAIL_STEP; stub attest.sh, gh, sonar-scanner and
# curl log their arguments. Every refusal must leave no "attest write" / "gh pr merge" /
# "sonar-scanner" line.
real_just=$(command -v just)
box="$work/box"; mkdir -p "$box/origin" "$box/stub"
git -C "$box/origin" init -q --bare -b main
git clone -q "$box/origin" "$box/repo" 2> /dev/null; cd "$box/repo"
git config user.email t@example.com && git config user.name t
cp "$root/justfile" "$root/mise.toml" "$root/mise.lock" . && mkdir scripts src coverage
printf '{"version":"0.0.0"}\n' > package.json
cat > scripts/attest.sh <<'EOF2'
#!/bin/sh
echo "attest $*" >> "$LOG"; [ "${ATTEST_FAIL:-0}" = 0 ]
EOF2
cat > "$box/stub/just" <<'EOF2'
#!/bin/sh
echo "just $*" >> "$LOG"
[ "${FAIL_STEP:-}" != "$1" ] || exit 1
[ "$1" != smoke ] || [ -z "${MOVE_HEAD:-}" ] || git commit -q --allow-empty -m 'chore: moved' --no-verify
EOF2
cat > "$box/stub/gh" <<'EOF2'
#!/bin/sh
echo "gh $*" >> "$LOG"; [ "${GH_FAIL:-}" != "$2" ] || exit 1
case "$*" in "pr view"*) git rev-parse origin/main ;; esac # the PR head: a real, fetchable commit
EOF2
cat > "$box/stub/sonar-scanner" <<'EOF2'
#!/bin/sh
echo "sonar-scanner $* token=${SONAR_TOKEN:-none}" >> "$LOG"; echo "sonar-scanner $*"; [ "${SCANNER_FAIL:-0}" = 0 ]
EOF2
cat > "$box/stub/pnpm" <<'EOF2'
#!/bin/sh
echo "pnpm $*" >> "$LOG"
EOF2
cat > "$box/stub/mise" <<'EOF2'
#!/bin/sh
case "$*" in *--bump*) printf '%s\n' "$MISE_OUT" ;; *) printf '%s\n' "${MISE_PATCH:-}" ;; esac
EOF2
cat > "$box/stub/curl" <<'EOF2'
#!/bin/sh
echo "curl $*" >> "$LOG"; [ "${SONAR_DOWN:-0}" = 0 ] && echo '{"status":"UP"}'
EOF2
chmod +x scripts/attest.sh "$box/stub"/*
export MISE_TRUSTED_CONFIG_PATHS="$box/repo" LOG="$work/log"
git add -A && git commit -qm 'chore: init' --no-verify && git push -q origin main 2> /dev/null
box_run() { # box_run <expected-exit> <label> <text the output or log must hold|-> -- <env>… <just args>
  want=$1 label=$2 text=$3; shift 4
  : > "$LOG"; rc=0; env PATH="$box/stub:$PATH" "$@" > "$work/out" 2>&1 || rc=$?
  [ "$rc" -eq "$want" ] || { cat "$work/out" "$LOG"; fail "$label: exit $rc, expected $want"; }
  [ "$text" = - ] || grep -qF -- "$text" "$work/out" "$LOG" || { cat "$work/out" "$LOG"; fail "$label: output lacks '$text'"; }
  ok
}
no_line() { ! grep -q "$1" "$LOG" || { cat "$LOG"; fail "$2"; }; ok; }

# gate: refusals first, then the order of the steps, then the two late refusals.
echo dirty > src/d && box_run 1 "gate: dirty tree refused" "commit or set aside" -- "$real_just" gate main
no_line '^just check' "gate ran check on a dirty tree"; rm src/d
git commit -q --allow-empty -m 'chore: unpushed' --no-verify
box_run 1 "gate: unpushed HEAD refused" "push HEAD first" -- "$real_just" gate main
no_line '^just check' "gate ran check on an unpushed HEAD"
git push -q origin main 2> /dev/null
box_run 0 "gate: green path" "attest write gate" -- "$real_just" gate main
[ "$(tr '\n' ' ' < "$LOG")" = "just check just sonar just smoke attest write gate " ] || { cat "$LOG"; fail "gate steps or order: $(cat "$LOG")"; }; ok
box_run 1 "gate: failing smoke stops it" - -- env FAIL_STEP=smoke "$real_just" gate main
no_line '^attest' "gate attested after a failed step"
box_run 1 "gate: failing check stops it" - -- env FAIL_STEP=check "$real_just" gate main
[ "$(tr '\n' ' ' < "$LOG")" = "just check " ] || { cat "$LOG"; fail "gate went past a failed check"; }; ok
box_run 1 "gate: failing sonar stops it" - -- env FAIL_STEP=sonar "$real_just" gate main
no_line '^just smoke' "gate ran smoke after a failed sonar"
box_run 1 "gate: failed attestation propagates" - -- env ATTEST_FAIL=1 "$real_just" gate main
box_run 0 "gate: default base" "attest write gate" -- "$real_just" gate
echo '#!/bin/sh' > scripts/new.sh && git add scripts/new.sh && git commit -qm 'ci(repo): ci change' --no-verify && git push -q origin HEAD:ci 2> /dev/null
box_run 1 "gate: a branch changing the local CI refused" "changes the local CI itself" -- "$real_just" gate origin/main
no_line '^just check' "gate ran check on a branch changing the local CI"
box_run 0 "gate: the same branch gated after reading" "attest write gate" -- env GATE_CI_CHANGE=1 "$real_just" gate origin/main
git reset -q --hard origin/main
printf '{"version":"0.0.1"}\n' > package.json && git commit -qam 'chore(repo): scripts change' --no-verify && git push -q origin HEAD:ci2 2> /dev/null
box_run 1 "gate: a branch changing package.json refused" "package.json" -- "$real_just" gate origin/main
git reset -q --hard origin/main
box_run 1 "gate: HEAD moved during the run" "HEAD moved" -- env MOVE_HEAD=1 "$real_just" gate main
no_line '^attest' "gate attested a HEAD that moved"
git reset -q --hard origin/main
git -C "$box/origin" update-ref refs/heads/ahead "$(git rev-parse HEAD)" && git commit -q --allow-empty -m 'chore: ahead' --no-verify && git push -q origin HEAD:ahead 2> /dev/null && git reset -q --hard origin/main
box_run 1 "gate: HEAD behind the base refused" "behind origin/ahead" -- "$real_just" gate origin/ahead
no_line '^just check' "gate ran check on a HEAD behind the base"

# merge: argument shape, the attestation, the exact gh command.
box_run 1 "merge: non-numeric PR refused" "usage just merge" -- "$real_just" merge --help
no_line '^gh' "merge called gh on a bad argument"
box_run 1 "merge: unattested head refused" - -- env ATTEST_FAIL=1 "$real_just" merge 7
no_line 'gh pr merge' "merge merged an unattested head"
head=$(git rev-parse origin/main)
box_run 0 "merge: attested head merged" "gh pr merge 7 --squash --match-head-commit $head" -- "$real_just" merge 7
grep -q "^attest verify gate $head\$" "$LOG" || fail "merge did not verify the head SHA"; ok
printf '#!/bin/sh\nexit 1\n' > scripts/attest.sh
box_run 0 "merge: verifier of origin/main, not the checkout's" "gh pr merge 7" -- "$real_just" merge 7
git checkout -q scripts/attest.sh
box_run 1 "merge: gh pr view failure propagates" - -- env GH_FAIL=view "$real_just" merge 7
no_line 'gh pr merge' "merge merged after gh pr view failed"
box_run 1 "merge: gh pr merge failure propagates" - -- env GH_FAIL=merge "$real_just" merge 7

# sonar: the five guards, then the call with the token in the environment and the gate wait.
mkdir "$box/bare" && for b in sh git find cat node; do ln -s "$(command -v "$b")" "$box/bare/$b"; done
box_run 1 "sonar: no scanner" "not on PATH" -- env PATH="$box/bare" HOME="$box" "$real_just" sonar
box_run 1 "sonar: no coverage report" "lcov.info missing" -- env HOME="$box" "$real_just" sonar
touch -d '10 seconds ago' coverage/lcov.info && touch src/newer
box_run 1 "sonar: stale coverage report" "older than" -- env HOME="$box" "$real_just" sonar
mv src/newer src/older && touch -d '10 seconds ago' src/older && touch coverage/lcov.info
box_run 1 "sonar: no token" "no token" -- env HOME="$box" "$real_just" sonar
no_line sonar-scanner "sonar ran the scanner without a token"
box_run 1 "sonar: server down" "not UP" -- env HOME="$box" SONAR_TOKEN=t0k SONAR_DOWN=1 "$real_just" sonar
no_line sonar-scanner "sonar ran the scanner against a server that is down"
box_run 0 "sonar: scan with the gate wait" "sonar-scanner -Dsonar.host.url=http://localhost:9000 -Dsonar.projectVersion=0.0.0 -Dsonar.qualitygate.wait=true token=t0k" -- env HOME="$box" SONAR_TOKEN=t0k "$real_just" sonar
grep -q 't0k' "$work/out" && fail "sonar passed the token on the command line"; ok
box_run 1 "sonar: failed quality gate fails the recipe" - -- env HOME="$box" SONAR_TOKEN=t0k SCANNER_FAIL=1 "$real_just" sonar

# toolchain drift: a --bump row of mise.toml other than node or pnpm, or a Node patch without --bump,
# counts; a Node major bump does not; a failing mise fails it.
drift() { box_run "$1" "drift: $2" "$3" -- env MISE_OUT="$4" MISE_PATCH="${5:-}" sh "$root/scripts/toolchain-drift.sh"; }
drift 0 "empty report" - ''
drift 0 "global rows ignored" - 'just  1.0.0  1.1.0  ~/.tool-versions'
drift 0 "pnpm follows package.json" - 'pnpm  10.0.0  10.9.9  mise.toml'
drift 0 "a Node major bump is not drift" - 'node  22  22.23.4  26  26.13.0  mise.toml'
drift 1 "a Node patch is drift" "node  22  22.23.3" 'node  22  22.23.3  26  26.13.0  mise.toml' 'node  22  22.23.3  22.23.4  mise.toml'
drift 1 "a mise.toml row fails" "bump mise.toml" "$(printf 'pnpm  10.0.0  10.9.9  mise.toml\njust  1.0.0  1.1.0  mise.toml')"
cat > "$box/stub/mise" <<'EOF2'
#!/bin/sh
exit 1
EOF2
drift 1 "mise outdated failure propagates" "mise outdated failed" ''
rm "$box/stub/mise"

# node-guard: the wrong major is refused before any step runs, the right one lets the step run.
echo 99.0.0 > .nvmrc
box_run 1 "node-guard: wrong Node major refused" "Node 99 required" -- "$real_just" smoke
no_line pnpm "smoke ran under the wrong Node"
node -p 'process.versions.node' > .nvmrc
box_run 0 "node-guard: right Node major passes" "pnpm test:smoke" -- "$real_just" smoke
unset MISE_TRUSTED_CONFIG_PATHS LOG

# L0 in a throwaway repository holding this repository's hook config and scripts. Only the jobs that
# need no package install run (secrets, shellcheck): the eslint and prettier jobs filter on paths
# this test does not stage.
repo="$work/repo"
mkdir -p "$repo" && cd "$repo"
git init -q -b main && git config user.email t@example.com && git config user.name t
cp -R "$root/scripts" "$root/lefthook.yml" "$root/justfile" "$root/mise.toml" "$root/mise.lock" .
export MISE_TRUSTED_CONFIG_PATHS="$repo" # not `mise trust`: it would leave a permanent entry for a deleted /tmp path
git add -A && git commit -qm init --no-verify
mkdir notes

fast() { # fast <expected-exit> <label> [<text the output must hold>]
  rc=0; just fast > "$work/out" 2>&1 || rc=$?
  [ "$rc" -eq "$1" ] || { cat "$work/out"; fail "$2: exit $rc, expected $1"; }
  [ -z "${3:-}" ] || grep -qF "$3" "$work/out" || { cat "$work/out"; fail "$2: output lacks '$3'"; }
  ok
}

echo 'Plain notes.' > notes/a.txt && git add notes/a.txt
fast 0 "clean staged change"

key="AKIA$(printf seed | sha256sum | cut -c1-16 | tr 'a-f0-9' 'A-FG-P')"
printf 'token %s\n' "$key" > notes/leak.txt && git add notes/leak.txt
fast 1 "staged secret refused" "leaks found"
git rm -q --cached notes/leak.txt

printf '#!/bin/sh\necho $x\n' > notes/bad.sh && git add notes/bad.sh
fast 1 "staged shell warning refused" "SC2154"

echo "test-local-ci: $n cases passed"
