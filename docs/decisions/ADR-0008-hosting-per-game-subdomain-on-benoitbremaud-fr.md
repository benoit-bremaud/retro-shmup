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
- Pages custom domains do not depend on the zone's Universal SSL wildcard: Pages provisions a
  Cloudflare for SaaS certificate per attached hostname (Advanced Certificate Manager docs,
  *Limitations*). Certificate coverage therefore does not constrain the subdomain depth.
- The owner already serves a project this way: `bulle-de-je.benoitbremaud.fr` is a first-level
  subdomain bound to its own Pages project (`bulle-de-je-preview`), verified in the dashboard.
- A browser origin is the full hostname: renaming a game's host after players have saved data
  makes that data (ADR-0006) unreachable from the new host.
- No playable build exists yet: the owner decided that nothing is deployed before the vertical
  slice.

## Decision

1. **Each game is served from its own first-level subdomain**, named after the game:
   `<game>.benoitbremaud.fr`, where `<game>` is the slug of the **final commercial title**. The
   custom domain is the canonical public URL; the project's `<project>.pages.dev` hostname stays
   reachable.
   **The custom domain is attached only once the title is final.** Until then the game is reached
   through its `pages.dev` URLs only (previews and the vertical-slice playtests), which carry no
   promise of persistence. This keeps the public origin stable, so players' saves are never
   stranded by a rename and no migration code is needed. If a rename is ever unavoidable after
   launch, it needs its own ADR with a save-export/import grace period before any redirect.
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
- **Nested subdomains** (`<game>.jeux.benoitbremaud.fr`) — viable (Pages issues a certificate per
  hostname) but not chosen: longer addresses for no functional gain, and inconsistent with the
  existing `bulle-de-je.benoitbremaud.fr`.

## Consequences

- Positive: adding a game costs a Pages project, a custom domain and a catalogue card; games stay
  independently releasable; per-origin storage isolates each game's save data; the portfolio
  needs no infrastructure change, only a page.
- Negative: one address per game; no shared navigation between games beyond the catalogue.
- Follow-ups (vertical slice), in order:
  1. Cloudflare dashboard (owner): Workers & Pages → create a Pages project connected to this
     repository through the GitHub App, production branch `main`, build settings of the slice.
  2. Playtests run on the project's `pages.dev` URLs; a pull request shows its preview URL.
  3. Once the commercial title is final: Pages project → Custom domains → add
     `<game>.benoitbremaud.fr`; confirm the `CNAME` Cloudflare proposes in the zone; wait for the
     certificate; verify with `curl -sI https://<game>.benoitbremaud.fr` (200, game `_headers`).
  4. The game's `_headers` file (PR in this repository); the catalogue page and card (PR in the
     portfolio repository); this repository's homepage URL set to the game's address.

## References

- ADR-0004 (delivery), ADR-0006 (player data), ADR-0007 (quality gate); GDD §11 (release scope).
- Cloudflare Pages, custom domains:
  https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Advanced Certificate Manager, *Limitations* (Pages uses Cloudflare for SaaS
  certificates): https://developers.cloudflare.com/ssl/edge-certificates/advanced-certificate-manager/
- MDN, `frame-ancestors`:
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors
- MDN, `Window.localStorage` (scoped to the document's origin):
  https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
