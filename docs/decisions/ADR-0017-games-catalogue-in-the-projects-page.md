# ADR-0017: The games catalogue is a category of the portfolio's projects page

**Status:** Accepted — 2026-10-10. **Partially supersedes ADR-0008**: decision 3 (the catalogue as
the static page `https://benoitbremaud.fr/jeux/`, with a thumbnail on each card) and the related
wording of its follow-up 4; **and ADR-0016**: the catalogue address in its decision 3 and its
follow-up 3. ADR-0008 decisions 1, 2 and 4 and the rest of ADR-0016 stand unchanged.

## Context

- ADR-0008 decision 3 put the games catalogue on the portfolio as its own page, `/jeux/`, one card
  per game with thumbnail, pitch, status and link.
- While that page was in review (benoit-bremaud/benoitbremaud.fr#14), the owner pointed out that
  games are one kind of project among others: IoT and hardware, web and infrastructure,
  automation and data, and future ones. The owner also wants to show projects by developer friends.
- The portfolio is a hand-written static site with no build step; every extra page is maintained
  by hand.

## Decision

1. **The games catalogue is the "Jeux" category of the portfolio's projects page**,
   `https://benoitbremaud.fr/projets/#jeux`. The projects page groups every project by category
   (Jeux, IoT et matériel, Web et infrastructure, Automatisation et data); the portfolio's own
   specification owns that list and its rules.
2. **Each game card** shows the game's status ("En développement" until release), a short
   description, a link to its playable address and a link to its public repository.
3. **The card thumbnail waits until the game has sprites**; a placeholder image would describe a
   game that does not exist yet.
4. There is no `/jeux/` page; it was never published.

## Alternatives considered

- **Keep `/jeux/` as its own page (ADR-0008 as is)** — rejected by the owner: one page per kind of
  project would multiply hand-maintained pages and split the portfolio's projects.
- **All projects on the portfolio's landing page** — rejected by the owner: the landing page would
  grow with every project and lose its short selection.
- **One page per category with a drop-down menu** — rejected: more pages to maintain, and a
  drop-down menu would need JavaScript, which the portfolio does not use.

## Consequences

- The game's public entry point from the portfolio is `/projets/#jeux`; a future game is one more
  card in that category.
- The portfolio's specification, use cases and tests carry the projects page once
  benoit-bremaud/benoitbremaud.fr#14 is reworked from its `/jeux/` version.
- ADR-0016 follow-up 3 now delivers the Jeux category card of `/projets/` instead of a `/jeux/`
  page.
- GDD v0.5 §13 and the Decision record point to `/projets/#jeux` (updated with this ADR).

## References

- ADR-0008 (hosting), ADR-0016 (deploy every playable build); benoit-bremaud/benoitbremaud.fr#14.
