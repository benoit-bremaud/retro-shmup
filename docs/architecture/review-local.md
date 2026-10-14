# Local review — retro-shmup (branch `docs/versioning`)

- Date: 2026-10-14
- Commit: see the branch tip
- Scope: branch diff `origin/main...HEAD` — ADR-0025 (SemVer, manual signed releases, the version
  shown outside the canvas), CONTRIBUTING "Versioning and releases", README paragraph, CHANGELOG
  and log notes, traceability scope, one wording fix in `.github/tag-protection.md`. Docs only.
- Checks run: design · docs · tests · security · correctness (one reconciled pass over a docs
  diff; no sub-agents)
- Verdict: **ship** · Must 0 · Should 0 · Nice 1

## 🔴 Must Have

_None._

## 🟡 Should Have

_None._

## 🔵 Nice to Have

- `docs/decisions/ADR-0025-versioning-policy.md` `[docs]` · the rejected-options text for
  release-please says to revisit if the manual steps become a burden; fine, no change.

## ⚪ Disagree / Intentional

- `.github/tag-protection.md` `[security]` · one sentence reworded: it said release-please would
  inherit the owner's bypass, which contradicts ADR-0025 (manual releases; an App would be added
  to `bypass_actors` in its own PR). Ruleset, commands and signing section are unchanged; the file
  is a document, not the ruleset itself.
- `CONTRIBUTING.md` / ADR-0025 `[docs]` · the game reads no URL parameter today; the surface is
  declared as "none yet" so a first parameter is public from its release.

## Per-dimension summary

- Design: policy decided in an ADR before the follow-up code PR (version text under the canvas).
- Docs: README, CONTRIBUTING, ADR index, matrix scope and log agree with each other.
- Tests: not applicable (no code).
- Security: the tag ruleset is kept; no secret or credential involved.
- Correctness: commands in the 4-step release procedure match `release-tag` (signed annotated
  tag, explicit push, release notes from the CHANGELOG).
