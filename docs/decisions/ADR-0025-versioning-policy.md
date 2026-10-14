# ADR-0025: Versioning policy — SemVer 2.0.0, a declared public surface, manual signed releases

**Status:** Accepted — 2026-10-14. Refines ADR-0004 (the `vMAJOR.MINOR.PATCH` tags it names) and
the owner's `semver-policy` and `release-tag` conventions, which this ADR applies to the game and
does not contradict. No earlier decision is superseded.

## Context

- `package.json` is at `0.0.0` and `CHANGELOG.md` has only an `[Unreleased]` section: no version
  or tag exists yet, although the vertical slice is playable on Cloudflare Pages (ADR-0016).
- SemVer needs a declared public surface, or "breaking" is undefined. A game has no library API;
  what a player can lose or depend on is the saved data and the addresses of the page.
- ADR-0004 fixes the tag format and a later itch.io upload with `butler --userversion`; ADR-0006
  versions the save document on its own; `.github/tag-protection.md` blocks creation, update and
  deletion of `v*` tags (admin bypass only), and tags are signed with an SSH key.
- A version must also be visible to a tester reporting a bug, and the placeholder fonts have no
  `.` or `+` glyph (brick G replaces them).

## Decision

1. **SemVer 2.0.0** (<https://semver.org/spec/v2.0.0.html>), `MAJOR.MINOR.PATCH`; the tag is the
   version with a `v` prefix (`v0.1.0`), `package.json` holds it without the prefix.
2. **The public surface** is exactly two things:
   - the **save document**, `localStorage` key `retro-shmup.v1`, whose own `version` field is the
     authoritative schema revision (ADR-0006) and is versioned **separately** from the game
     version;
   - the **URL parameters** the page reads (none yet; each becomes public surface from the release that introduces it).

   Gameplay balance and rules are **not** public API: tuning a number or a pattern is never a
   breaking change.
3. **Bumps** (from `semver-policy`, applied to this surface):

   | Bump | When |
   |---|---|
   | MAJOR (from 1.0.0) | the save format is incompatible and not migrable, or a documented control is removed |
   | MINOR | new content or feature: a level, an enemy, a mode, an option |
   | PATCH | fixes, rebalancing, visual or audio polish with no new content |

   Before 1.0.0 a breaking change bumps the MINOR. **1.0.0 is the public release on itch.io.**
4. **First release.** `v0.1.0` is cut **after** the rebalance design (#53) and its tuning PRs are
   merged: a coherent playable vertical slice, brick F done, level 1 rebalanced. **No retroactive
   tags.** Until then `package.json` stays `0.0.0` and the changelog stays `[Unreleased]`.
5. **Release mechanics, manual**, from `main`, by the owner:
   1. a release PR `chore(repo): release X.Y.Z` bumps `package.json`, renames `[Unreleased]` to
      `[X.Y.Z] - date` in `CHANGELOG.md`, adds the compare and release links and adds a
      `PROJECT_LOG.md` entry;
   2. after the merge, the **signed annotated tag** `git tag -s vX.Y.Z -m "..."` then
      `git push origin vX.Y.Z` (the admin bypass of the `v*` ruleset; SSH signing is configured);
   3. `gh release create vX.Y.Z --notes-file <changelog section>`: the changelog section is the
      body, the GitHub auto-generated list may follow as a complement (`release-tag`);
   4. later, the itch.io upload passes the version (`butler push … --userversion X.Y.Z`,
      ADR-0004).

   Tags are immutable. A bad release is retired by **superseding** it with a higher version and
   flagging it (demote the GitHub release to pre-release with a note), never deleted or moved
   (`release-tag`). Prereleases are `vX.Y.Z-rcN`, undotted counter.
6. **Version shown in the game**: a small text **outside the canvas**, set with `textContent`
   (ESLint bans `innerHTML`), reading `v<version>+<short commit>`. The version comes from
   `package.json`, the commit from Cloudflare Pages' build variable `CF_PAGES_COMMIT_SHA` or from
   git locally, both injected at build. It moves to the Options / About screen in brick G with the
   final font. Reason: the placeholder fonts lack `.` and `+`. **Decided here, implemented in a
   separate follow-up PR** (the rule in the GDD, then the code): this ADR changes no code.

## Alternatives considered

The owner chose among scored options; the rejected ones, with the reason:

- **release-please** (release PR and tag by GitHub Actions) — rejected: it creates tags from a
  workflow, which the `v*` ruleset (admin bypass only) forbids; it would force a bypass for a
  bot or an App, produces unsigned tags, and needs a workflow edit (workflows are protected
  files). Revisit if the release rhythm makes the manual steps a burden.
- **Tag only, no release notes** — rejected: the changelog would stay unpublished and the itch.io
  and GitHub pages would show no human-written notes (`release-tag`: the changelog is the
  canonical narrative).
- **Calendar versioning or a build number** — rejected: they say nothing about save
  compatibility, the one promise made to players.
- **Balance and rules as public API** — rejected: every tuning PR would be a release-class event
  and the pre-1.0 cadence of rebalancing would make MAJOR meaningless.
- **Retroactive tags on past merges** — rejected: the slice was not a coherent release.
- **Version drawn inside the canvas now** — rejected: no `.` or `+` glyph in the placeholder
  fonts, and brick G replaces them.

## Consequences

- Positive: one number answers "can my save survive?"; releases are signed, reproducible from
  the tag and carry human release notes; a tester can quote `v0.1.0+abc1234`.
- Negative: four manual steps per release and a visible `0.0.0` until `v0.1.0`; the version text
  is a stop-gap in the page until brick G.
- Standing obligations: every save-format change follows ADR-0006 (bump the document `version`,
  migration, fixture) and the bump table above; a new URL parameter is public surface from its
  first release.
- Follow-up PR (not here): GDD rule for the displayed version, build-time injection of
  `package.json`'s version and the commit, the `textContent` element with its test, then the
  move to Options / About in brick G.
- `.github/tag-protection.md` mentioned release-please as the release automation; its wording is
  aligned with this ADR.

## References

- ADR-0004, ADR-0006, ADR-0016; `.github/tag-protection.md`; `CONTRIBUTING.md` § Versioning and
  releases; the owner's `semver-policy` and `release-tag` skills; <https://semver.org/spec/v2.0.0.html>.
