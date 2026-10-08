<!--
  Title format (Conventional Commits):
    <type>(<scope>): <short description>

  Types:  feat, fix, refactor, docs, test, chore, perf, style, build, ci
  Scopes: design, adr, uml, docs, ci, repo,
          engine, game, render, audio, input, ui, levels, assets, i18n, tests

  Examples:
    docs(design): tune the chain multiplier thresholds
    feat(engine): fixed-timestep loop with accumulator
    fix(input): gamepad bomb intent fired twice per press
-->

## Summary

<!-- One short paragraph or 2-4 bullets. What this PR does and why. -->

-

## Context

<!-- Optional. Drop the section if the Summary is enough.
     Use it for: GDD sections, ADRs, UML diagrams, prior discussion, related PRs,
     screenshots, trade-offs you want the reviewer to notice. -->

## Checklist

<!-- Tick what applies; explain anything skipped. -->

- [ ] Conforms to the [GDD](docs/design/game-design-document.md) and the relevant ADRs ([docs/decisions/](docs/decisions/)); no validated decision reopened silently
- [ ] UML diagrams validated under `docs/architecture/diagrams/<feature>/` for any new feature
- [ ] Happy path + sad path + edge cases covered by tests (code changes)
- [ ] No `any`, no default exports
- [ ] No browser API (`canvas`, `window`, `AudioContext`, `Date.now()`, `Math.random()`) in the domain — ports and adapters only
- [ ] No allocation inside the game loop (object pools)
- [ ] Security checklist of the owner's security policy applied to the diff: no HTML injection sink or `eval` (INJ-3/4), untrusted input — save document, URL, storage — validated by allowlist (INPUT-1/2), no secret in code or logs (SECRET-1..3), fails closed with no swallowed error (ERR-1/2), security headers for any deployed page (CONFIG-2), actions pinned by SHA and lockfile committed (SUPPLY-1)
- [ ] `make verify` passed locally (includes gitleaks, dependency audit and the SonarQube quality gate)
- [ ] Every new player-facing string goes through the message catalogue (EN + FR)
- [ ] `CREDITS.md` updated for any asset added or replaced
- [ ] `PROJECT_LOG.md` will be updated after merge

## Linked issue

<!-- Use Closes/Fixes for issues this PR finishes; Refs for partial work. -->

Closes #
