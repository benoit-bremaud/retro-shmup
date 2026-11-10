#!/bin/sh
# Tests for scripts/attest.sh (#156; agents-skills #213 and its ADR-0003/0004, not this repository's ADRs), against a fake
# `gh` (commit statuses kept in files), a bare remote and throwaway SSH keys: the attestation is
# written and pushed, verified from a second clone, and refused when missing, forged, moved to
# another commit or carried by a non-release, unsigned or foreign-signed tag; a status of another
# context or a non-success gate status is refused. Needs git, ssh-keygen, jq (the fake `gh` applies
# the real `-q` filter of attest.sh to the stored JSON).
set -e
# shellcheck disable=SC2046 # one variable name per word
unset $(git rev-parse --local-env-vars)
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
n=0
fail() { echo "FAIL $1"; exit 1; }

mkdir -p "$work/bin" "$work/status"
cat > "$work/bin/gh" <<'EOF'
#!/bin/sh
case "$*" in
  "repo view"*) echo o/r ;;
  "api --silent -X POST repos/o/r/statuses/"*) sha=${5##*/}; state=; ctx=
    for a; do case $a in state=*) state=${a#state=} ;; context=*) ctx=${a#context=} ;; esac; done
    printf '{"context":"%s","state":"%s"}' "$ctx" "$state" > "$FAKE_STATUS/$sha" ;;
  "api repos/o/r/commits/"*) sha=${2#repos/o/r/commits/}; sha=${sha%/status}; [ "$3" = -q ] || exit 1
    printf '{"statuses":[%s]}' "$(cat "$FAKE_STATUS/$sha" 2>/dev/null)" | jq -r "$4" ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$work/bin/gh"
PATH="$work/bin:$PATH" FAKE_STATUS="$work/status"
export PATH FAKE_STATUS

ssh-keygen -q -t ed25519 -N '' -C t@example.com -f "$work/key"
ssh-keygen -q -t ed25519 -N '' -C x@example.com -f "$work/other"
git init -q --bare -b main "$work/remote.git"
repo="$work/repo"
git init -q -b main "$repo" && cd "$repo"
git config user.email t@example.com && git config user.name t
git config gpg.format ssh && git config user.signingkey "$work/key.pub"
git remote add origin "$work/remote.git"
mkdir -p scripts .github
cp "$root/scripts/attest.sh" scripts/
printf 't@example.com %s\n' "$(cat "$work/key.pub")" > .github/allowed_signers
git add -A && git commit -qm init && git push -q origin main
first=$(git rev-parse HEAD)

# run <expected-exit> <label> <text the output must hold> <command…>
run() {
  want=$1 label=$2 text=$3; shift 3
  rc=0; "$@" > "$work/out" 2>&1 || rc=$?
  [ "$rc" -eq "$want" ] || { cat "$work/out"; fail "$label: exit $rc, expected $want"; }
  grep -qF -- "$text" "$work/out" || { cat "$work/out"; fail "$label: output lacks '$text'"; }
  n=$((n + 1))
}

run 1 "no status, no gate" "status gate is missing" sh scripts/attest.sh verify gate HEAD
printf '{"context":"ci","state":"success"}' > "$work/status/$first"
run 1 "a green status of another context is not the gate" "status gate is missing" sh scripts/attest.sh verify gate HEAD
printf '{"context":"gate","state":"failure"}' > "$work/status/$first"
run 1 "a failed gate status refused" "status gate is failure" sh scripts/attest.sh verify gate HEAD
run 1 "option-shaped commit refused" "looks like an option" sh scripts/attest.sh verify gate --output=x
run 0 "gate written" "gate recorded on $first" sh scripts/attest.sh write gate
git ls-remote --exit-code origin refs/notes/gate > /dev/null || fail "gate note not pushed"; n=$((n + 1))
run 0 "gate verified" "gate verified on $first (t@example.com)" sh scripts/attest.sh verify gate HEAD
run 1 "no staging note yet" "no deploy/staging note" sh scripts/attest.sh verify deploy/staging HEAD
run 1 "unknown kind" "unknown kind" sh scripts/attest.sh write prod

# A second clone fetches the notes before reading and before adding (no forked notes history).
git clone -q "$work/remote.git" "$work/clone"
cd "$work/clone"
git config user.email t@example.com && git config user.name t
git config gpg.format ssh && git config user.signingkey "$work/key.pub"
run 0 "gate verified from a clone" "gate verified on $first" sh scripts/attest.sh verify gate HEAD
run 0 "staging attested from the clone" "deploy/staging recorded" sh scripts/attest.sh write deploy/staging
cd "$repo"
run 0 "staging note fetched back" "deploy/staging verified on $first" sh scripts/attest.sh verify deploy/staging HEAD

# write refuses what the gate did not see: a dirty tree, an unpushed HEAD.
echo b > b
run 1 "dirty tree refused" "uncommitted changes" sh scripts/attest.sh write gate
git add b && git commit -qm second
run 1 "unpushed HEAD refused" "is not pushed" sh scripts/attest.sh write gate
git push -q origin main
second=$(git rev-parse HEAD)

# Forgeries: a note signed by a key outside the trust store (even one the checkout trusts), a
# note copied to another commit.
printf '{"context":"gate","state":"success"}' > "$work/status/$second"
printf 'gate o/r %s\n' "$second" > "$work/payload"
ssh-keygen -q -Y sign -n local-ci -f "$work/other" "$work/payload" > /dev/null 2>&1
cat "$work/payload" "$work/payload.sig" | git notes --ref refs/notes/gate add -f -F - "$second"
git push -q origin refs/notes/gate
run 1 "foreign key refused" "not signed by a key" sh scripts/attest.sh verify gate HEAD
printf 'x@example.com %s\n' "$(cat "$work/other.pub")" >> .github/allowed_signers
run 1 "trust store of the checkout ignored" "not signed by a key" sh scripts/attest.sh verify gate HEAD
git checkout -q .github/allowed_signers
# A trusted key signing another payload under a correct header: the cryptographic check itself.
printf "junk\n" > "$work/junk"
ssh-keygen -q -Y sign -n local-ci -f "$work/key" "$work/junk" > /dev/null 2>&1
cat "$work/payload" "$work/junk.sig" | git notes --ref refs/notes/gate add -f -F - "$second"
git push -q -f origin refs/notes/gate
run 1 "trusted key, wrong payload refused" "bad signature" sh scripts/attest.sh verify gate HEAD
git notes --ref refs/notes/gate show "$first" | git notes --ref refs/notes/gate add -f -F - "$second"
git push -q origin refs/notes/gate
run 1 "note moved to another commit refused" "names another commit" sh scripts/attest.sh verify gate HEAD

# Release checks: a signed stable tag on the attested commit passes, anything else is refused.
git tag -s -m v1.0.0 v1.0.0 "$first"
run 0 "signed stable tag" "$first" sh scripts/attest.sh release v1.0.0
[ "$(sh scripts/attest.sh release v1.0.0 2>/dev/null)" = "$first" ] || fail "release must print the SHA alone on stdout"; n=$((n + 1))
git tag -s -m rc v1.1.0-rc.1 "$first"
run 1 "pre-release refused" "not a stable release tag" sh scripts/attest.sh release v1.1.0-rc.1
git tag -a -m unsigned v1.2.0 "$first"
run 1 "unsigned tag refused" "is not signed" sh scripts/attest.sh release v1.2.0
git -c user.signingkey="$work/other.pub" tag -s -m foreign v1.3.0 "$first"
run 1 "tag signed by a foreign key refused" "not signed by a key of the trust store" sh scripts/attest.sh release v1.3.0
run 1 "two-component tag refused" "not a stable release tag" sh scripts/attest.sh release v1.0
run 1 "option-shaped tag refused" "not a stable release tag" sh scripts/attest.sh release -v1.0.0
git tag -s -m v2.0.0 v2.0.0 "$second"
run 1 "tag on a commit with a moved note refused" "names another commit" sh scripts/attest.sh release v2.0.0
echo c > c && git add c && git commit -qm third && git push -q origin main
run 0 "third commit gated" "gate recorded" sh scripts/attest.sh write gate
git tag -s -m v3.0.0 v3.0.0 HEAD
run 1 "tag without the staging QA note refused" "no deploy/staging note" sh scripts/attest.sh release v3.0.0


echo "test-attest: $n cases passed"
