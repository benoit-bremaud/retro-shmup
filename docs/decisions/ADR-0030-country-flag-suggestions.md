# ADR-0030: Choose the country by flag — six suggested flags first, the letters behind *OTHER*

**Status:** Accepted — 2026-11-12. **Partially supersedes ADR-0028** (its rejection of "a flag
picker grid replacing the letters", 235/500: the flags still do not replace the letters, they come
first and *OTHER* leads to them) and **amends ADR-0021** decision 4 (the browser hints now feed
the suggestions instead of preselecting a code). Values are GDD v0.34 values (§9.1 *The country
choice*). Issue #145.

## Context

- Since v0.27 a flag is drawn beside every code (ADR-0028), but the player still has to type two
  letters of an ISO code. A child or a tester who does not know the codes cannot pick their
  country (owner, 2026-11-12).
- ADR-0028 rejected a flag picker *replacing* the letters: about 250 flags need a scrolling grid,
  against the no-scrolling rule of the menus. A short page of likely flags does not have that
  problem, provided the letters stay available.
- The browser already tells the game two offline hints (time zone country, language region;
  ADR-0021 decision 4 and its 2026-10-26 amendment) and the save holds the previous choice.
- The domain never imports the browser (CLAUDE.md); the hints reach it through `SceneHost`.
- The letters page, its cell geometry (30 px columns, 32 px rows from y 104, #115) and
  `RenderPort.drawFlag` already exist.

## Decision

1. **Two pages.** The country choice opens on a **suggestions page**, heading *COUNTRY* / *PAYS*:
   a grid of **2 rows × 4 cells of 60 × 32 px** (two `LETTER_GRID` columns, span 2, from y 104).
   Cells 1–6 are suggested countries, cell 7 is *NONE* / *AUCUN*, cell 8 is *OTHER* / *AUTRE*
   (new message key `otherCountry`).
2. **A suggested cell** draws its code then its 16 × 11 flag, 2 px apart, centred together; when
   no flag is drawn (ADR-0028 fallback) the code alone, centred.
3. **Suggestion order** (`suggestedCountries(hints, saved)` in
   `src/domain/hall-of-fame/country-suggestions.ts`, which replaces `preselection.ts`): the
   browser hints (`countryHints(timeZone, languageRegion)`: time zone's country, then language
   region), then the saved country, then `FR`, `BE`, `CH`, `CA`, `US`, `GB`; known codes only,
   each once, cut to `SUGGESTION_COUNT` = 6. Computed when the choice opens, never per frame.
4. **Behaviour.** The cursor opens on the saved country when suggested, else on the first cell.
   A flag (`confirm` or tap) chooses its country at once and saves it; *NONE* chooses no country;
   `back` on the suggestions cancels (nothing saved; to the title or the options as before).
5. **The letters page** is the former screen (letter grid, *DEL*, *NONE*, *OK* only for a known
   code) behind *OTHER*, opened **empty** with the cursor on `A`. `back` there deletes the last
   letter; on an empty code it returns to the suggestions with the cursor on *OTHER*.
6. **Wiring.** `SceneHost.preselectedCountry()` becomes `countryHints(): readonly string[]`;
   `CountryChoice.open(now, opening, hints, saved)`, a `byLetters` getter; the scene machine
   draws `drawCountrySuggestions` or `drawNameEntry` by page and plays *MenuConfirm* also when the
   page switches.

## Consequences

- The common case (a French player in France, a saved choice) is one confirm; the rare country
  costs *OTHER* plus two letters.
- The browser hints are no longer stored as a preselected code, so ADR-0021's "stored only on
  confirmation" holds trivially: a flag is a confirmation.
- Tests: the suggestion order (hints, saved, common list, unknown and duplicate codes), both
  pages' navigation and `back` rules, the overlay drawing (code and flag centred, code alone),
  the browser smoke test follows the new first step.
- `preselection.ts` and its tests are removed; no stored data changes (save version unchanged).

## MCDA (owner-validated, 2026-11-12)

- **Layout**: **2 × 4 grid of 60 × 32 px cells** (445/500) against a 3 × 3 grid and a scrolling
  list.
- **NONE placement**: **inside the grid** (455/500) against a separate row below it.

## Rejected alternatives

- **A flag picker replacing the letters** (235/500, ADR-0028): needs scrolling; kept rejected.
- **A 3 × 3 grid**: smaller cells, a ninth suggestion that adds little.
- **A scrolling list of flags**: against the no-scrolling rule of the menus.
- **NONE in a separate row below the grid**: a fifth target row for a rare choice.
- **Keeping the letters first with a flag hint**: still asks for ISO codes up front.
