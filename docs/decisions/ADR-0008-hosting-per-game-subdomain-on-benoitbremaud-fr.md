# ADR-0008: Public hosting — one subdomain per game on benoitbremaud.fr, catalogue on the portfolio

**Status:** Accepted — 2026-10-08

## Context

- ADR-0004 fixes the delivery platform (Cloudflare Pages: preview per pull request, production on
  `main`) but not the public address; this ADR complements it and supersedes nothing. The owner
  wants the game reachable from the personal portfolio on the domain `benoitbremaud.fr`, and
  plans **several games**, not only this one.
- Facts verified on 2026-10-08: the domain's DNS is hosted on Cloudflare (nameservers
  `craig.ns.cloudflare.com`, `noor.ns.cloudflare.com`); the portfolio is a separate repository
  (`benoit-bremaud/benoitbremaud.fr`), a static site served by its own Cloudflare Pages project
  from `main`; its `_headers` file sends `X-Frame-Options: DENY` and
  `Cross-Origin-Opener-Policy: same-origin` on every path; the domain's mail is hosted elsewhere
  (SPF record), which hosting must not touch.
- Constraints carried by earlier decisions: each game keeps its own repository, release cycle and
  quality gate (ADR-0004, ADR-0007); player data lives in `localStorage`, which the browser
  partitions **per origin** (ADR-0006). The itch.io release is a separate copy: `butler` uploads
  the build to itch.io's own servers (ADR-0004), so itch.io never frames the copy hosted here.
- Cloudflare's free Universal SSL certificate covers the apex and **first-level** subdomains
  (`*.benoitbremaud.fr`) only; deeper names such as `game.games.benoitbremaud.fr` would need a
  paid Advanced Certificate Manager certificate (or a custom certificate).
- No playable build exists yet: the owner decided that nothing is deployed before the vertical
  slice.

## Decision

1. **Each game is served from its own first-level subdomain**, named after the game:
   `<game>.benoitbremaud.fr`. For this repository: `retro-shmup.benoitbremaud.fr` until the
   commercial title is chosen; the new name is then added as a custom domain and the old one
   redirects to it (Cloudflare redirect rule, decided in the rename PR). The custom domain is the
   canonical public URL; the project's `<project>.pages.dev` hostname stays reachable.
2. **Each game has its own Cloudflare Pages project**, connected to its own repository through the
   GitHub App (ADR-0004), with the subdomain attached as a custom domain. Cloudflare creates the
   `CNAME` record in the zone automatically; no other DNS record is touched.
3. **The catalogue lives on the portfolio** as a static page `https://benoitbremaud.fr/jeux/`
   (French, like the portfolio), with one card per game (thumbnail, pitch, status, link). It is a
   change to the portfolio repository, proposed there by its own pull request.
4. **Each game ships its own `_headers`**, independent of the portfolio's: at least
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a
   `Content-Security-Policy` with `frame-ancestors 'self' https://benoitbremaud.fr`, so the
   portfolio catalogue may embed a game (another subdomain is a different origin) and nothing
   else can. The itch.io copy is served by itch.io and does not read these headers.
5. **Timing**: nothing is created on Cloudflare before the vertical slice. At that point the owner
   creates the Pages project and the custom domain in the Cloudflare dashboard (owner-only
   account actions), following the steps listed under *Consequences*; their execution is then
   recorded in `PROJECT_LOG.md`.

## Alternatives considered

- **Single "arcade" subdomain with a path per game** (`jeux.benoitbremaud.fr/<game>/`) — rejected:
  needs a routing Worker to maintain (one route per new game), every game built with a path
  prefix, and all games sharing one origin, hence one `localStorage`; reconsider only if a
  unified URL becomes a requirement — the Worker can be added in front of the same Pages projects
  without changing them.
- **One repository for every game** — rejected: couples releases, CI and failures across games,
  the opposite of ADR-0004 and ADR-0007.
- **The game under the portfolio's path** (`benoitbremaud.fr/jeu/`) — rejected: either couples
  the two repositories or needs a Worker, and shares the portfolio's origin, hence its storage and
  its security headers, which then have to fit two different applications.
- **Nested subdomains** (`<game>.jeux.benoitbremaud.fr`) — rejected: not covered by the free
  Universal SSL certificate.

## Consequences

- Positive: adding a game costs a Pages project, a custom domain and a catalogue card; games stay
  independently releasable; per-origin storage isolates each game's save data; the portfolio
  needs no infrastructure change, only a page.
- Negative: one address per game; no shared navigation between games beyond the catalogue.
- Follow-ups (vertical slice), in order:
  1. Cloudflare dashboard (owner): Workers & Pages → create a Pages project connected to this
     repository through the GitHub App, production branch `main`, build settings of the slice.
  2. Pages project → Custom domains → add `retro-shmup.benoitbremaud.fr`; confirm the `CNAME`
     Cloudflare proposes in the zone; wait for the certificate to become active.
  3. Verify: `curl -sI https://retro-shmup.benoitbremaud.fr` returns 200 with the game's
     `_headers`; a pull request shows its preview URL.
  4. The game's `_headers` file (PR in this repository); the catalogue page and card (PR in the
     portfolio repository); this repository's homepage URL set to the game's address.

## References

- ADR-0004 (delivery), ADR-0006 (player data), ADR-0007 (quality gate); GDD §11 (release scope).
- Cloudflare Pages, custom domains:
  https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Universal SSL limitations (apex and first-level subdomains):
  https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/
- MDN, `frame-ancestors`:
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors
- MDN, `Window.localStorage` (scoped to the document's origin):
  https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
