# ADR-0016: Deploy every playable build, from the first playable on

**Status:** Accepted — 2026-10-09. **Partially supersedes ADR-0008**: decision 5 (nothing created
on Cloudflare before the vertical slice) and the timing of its follow-ups 1, 2 and 4. Decisions
1 to 4 of ADR-0008 (address, project, catalogue, headers) stand unchanged.

## Context

- ADR-0008 decision 5 waited for the vertical slice — level 1 complete at release quality —
  before creating anything on Cloudflare, so an unfinished game would not be public.
- The first playable build (PR #8) runs on keyboard: the ship flies in, moves and fires. The owner
  wants it online now, reached from the portfolio, and then wants to improve the game by small
  iterations, each one played online.
- ADR-0004 already makes every merge to `main` a production deployment and every pull request a
  preview, once the Pages project exists. Nothing else in the delivery chain waits for the slice.

## Decision

1. **The Cloudflare Pages project is created now**, by the owner, with the settings of ADR-0008
   follow-up 1, and the game is published at its `pages.dev` address (ADR-0008 decision 1).
2. **Every merge to `main` deploys the playable build** (ADR-0004); every pull request gets its
   preview URL for playtests. No brick waits for the vertical slice to be online.
3. **The portfolio presents it as a work in progress.** The catalogue card on
   `benoitbremaud.fr/jeux/` says the game is in development, so no visitor takes it for a
   finished release. The custom subdomain still waits for the final title (ADR-0008 decision 1).

## Alternatives considered

- **Wait for the vertical slice (ADR-0008 as is)** — rejected by the owner: the game would stay
  invisible for several bricks, and the iterations could not be played online.
- **Publish only pull-request previews** — rejected: preview URLs change with every pull request
  and cannot be linked from the portfolio.
- **Record a one-off exception in the project log** — rejected: deploying every playable build is
  the new way of working, not an exception, and a log line would leave ADR-0008 contradicted.

## Consequences

- The public game is unfinished; the catalogue card says so.
- The security headers ship with the first deployment (ADR-0008 decision 4).
- Saves made inside a portfolio embed are separate from saves made on the game's own address, since
  the two are different sites (ADR-0006); the catalogue links to the game rather than embedding it.
- Owner actions, recorded in the project log when done: create the Pages project; check the first
  deployment with `curl -sI https://<project>.pages.dev`.

## References

- ADR-0004 (delivery), ADR-0006 (player data), ADR-0008 (hosting); PR #8 (first playable build).
