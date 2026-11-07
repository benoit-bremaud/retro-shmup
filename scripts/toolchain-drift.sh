#!/bin/sh
# Toolchain drift (step of `just nightly`): fails when a tool pinned in mise.toml is behind its latest
# release. `mise outdated` exits 0 whatever it finds and still lists the global ~/.tool-versions under
# --no-global, so only the mise.toml rows count (`--bump`: without it exact pins report nothing).
# pnpm follows package.json#packageManager on purpose; Node is a major pin, so its patches count.
set -eu
out=$(mise outdated --bump --no-global --no-header) || { echo "toolchain-drift: mise outdated failed" >&2; exit 1; }
drift=$(printf '%s\n' "$out" | grep -F mise.toml | grep -vE '^pnpm ' || true)
[ -z "$drift" ] || { echo "toolchain-drift: bump mise.toml:"; echo "$drift"; exit 1; }
