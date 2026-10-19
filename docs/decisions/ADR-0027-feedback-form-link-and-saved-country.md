# ADR-0027: Feedback through an external form link, and the country saved once

**Status:** Accepted — 2026-10-19. **Clarifies ADR-0006** ("no network call in 1.0"): opening an
external page in a new tab at the player's request is a navigation, not a call made by the game.
**Amends ADR-0021** decision 4: the country is chosen once and saved in the options, then copied
into each entry, instead of being picked at every name entry. Every other part of ADR-0006 and
ADR-0021 stands. Values are GDD v0.26 values (§9.1, §9.3, §9.8).

## Context

- The owner wants playtest feedback from friends and family without asking each by hand: what
  works, what does not, suggestions, and a free text (owner, 2026-10-16 and 2026-10-19).
- 1.0 has no backend and makes no network call (CLAUDE.md, ADR-0006), and the game has no HTML
  text field: every input is drawn in the canvas.
- The owner wants no e-mail address visible anywhere, and questions that change as the game
  evolves without a new release.
- Browsers open a new tab only inside a user activation (a click, tap or key press); a gamepad
  press is not one. The fullscreen request already lives with this rule (ADR-0009).
- The owner wants the flag chosen before playing, not at the end of each run.

## Decision

1. **The answers live in an external form** (Tally, hosted in the EU, anonymous by default), owned
   and edited by the owner. The game holds only its address, a build constant; an empty address
   hides every feedback entry point.
2. **The game opens the address in a new tab** (`window.open` with `noopener,noreferrer`, in the
   browser adapter only, behind a port), at the player's request: the *Feedback* row of the title
   menu, or *Give feedback* on the offer shown after each run end. The game itself sends no
   request; the player's browser loads the form like any link. This is the meaning of "no network
   call" for 1.0 from now on: no `fetch`, XHR, beacon, WebSocket or script loaded by the game.
3. **Context as query parameters**, built in the domain by a pure function from allowlisted values
   and encoded with `encodeURIComponent`: `set`, `version`, `score`, `level`, `country`, `device`,
   `lang`. The name and anything personal are never sent. These parameters are outgoing: they are
   not part of the page's public surface of ADR-0025 decision 2, but renaming one breaks the form's
   hidden fields, so the form and the game change them together.
4. **Rotating question sets**: `set` = (the saved feedback count mod 3) + 1; the count rises by one
   at each opening. The form shows the block matching `set`. **Fallback** if the form cannot branch
   on a hidden field: one form per set, the build holding three addresses instead of one; the game
   logic is the same.
5. **Gesture**: a tap, click or key opens the tab at once; a gamepad press goes through the gesture
   prompt and the next click, tap or key opens it. A refused opening (the call returns no window)
   shows a short message and keeps the offer.
6. **The country is saved once**: the options hold the country choice — absent, `none`, or a code
   of `COUNTRY_CODES` — asked at the first *Play* while absent, and changed from the options. The
   name entry stores the saved code (absent for `none`). Both new fields are optional: the save
   stays at version 2, an invalid value reads as absent (the choice) or 0 (the count).

## Consequences

- Questions change in the form without a release; three sets give about twice the answers per
  question of five with ~10 testers.
- The game depends on a third-party site for feedback only; if the form is gone, the tab shows
  the site's error and the game is unaffected.
- Testers' free text reaches Tally (a processor in the EU); the README's privacy note says so.
- The name entry is one step shorter; a player who never plays never sees the country question.
- The CSP of ADR-0008 is unchanged: it does not govern top-level navigation in a new tab.

## Rejected alternatives

- **A pre-filled `mailto:` link** (375/500): the owner's address public in the repository and the
  page (spam), and many computers have no mail client.
- **Answers kept locally with an export** (330/500): testers would have to send a file.
- **An HTML form over the canvas** (370/500): a text field in the page, against the drawn-input
  rule, and still no way to send without a backend.
- **A v2 Worker receiving the answers**: a backend, out of 1.0 scope (GDD §11.3).
- **The country asked at every name entry, preselected from the saved one** (385/500): one step
  per entry for no gain.
