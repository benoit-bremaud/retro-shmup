#!/bin/sh
# Documentation coverage of src/: exports preceded by a doc block, floor 90 % (owner rule
# 2026-10-16; step of `just test`). Companion `type X = (typeof X)[keyof typeof X]` lines and
# re-exports are not counted: the const's doc is theirs.
set -eu
git ls-files 'src/**/*.ts' | xargs awk '
  FNR == 1 { prev = "" }
  /^export (type [A-Za-z]+ = \(typeof|\{)/ { next }
  /^export / { total++; if (prev !~ /\*\/[[:space:]]*$/) missing++ }
  !/^[[:space:]]*$/ { prev = $0 }
  END { if (total == 0) { print "doc coverage: no export found under src/"; exit 1 }
        pct = (total - missing) * 100 / total;
        printf "doc coverage: %d/%d exports documented (%.1f %%, floor 90)\n", total - missing, total, pct;
        exit (pct < 90) }'
