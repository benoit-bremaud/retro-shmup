# ADR-0026: The smoke test in three engines, with a hall-of-fame persistence check

**Status:** Accepted — 2026-10-16. Refines ADR-0003 (decision 7, "exactly one Playwright smoke
test") and ADR-0007 (`make smoke`, manual, not in CI). No earlier decision is superseded.

## Context

- The owner asked (2026-10-16) that the names saved in the hall of fame provably persist, and that
  the game be checked in any major browser.
- Names already persist: `SaveStore` writes the whole save document (`retro-shmup.v1`, ADR-0006,
  ADR-0021) to `localStorage` on a new top 10 and on an options change. Only unit tests cover it,
  with the storage port mocked; the smoke runs in Chromium only and never reloads the page.
- Storage is per browser and per origin: a table shared across browsers or devices needs a
  backend, out of scope for 1.0 (CLAUDE.md, planned for v2).
- The smoke reads the frame time through the Chrome DevTools Protocol, which only Chromium has.
- `make smoke` leaves a `vite preview` process on port 4173: the `webServer` command is a shell
  `build && preview` chain, and stopping the shell does not stop its child.

## Decision

1. **Still one smoke test file**, `tests/smoke/first-playable.spec.ts`, run in **three engines**:
   Playwright projects `chromium`, `firefox` and `webkit`. "Exactly one smoke test" means one
   scenario file, not one browser.
2. **A persistence step** in that file, with no gameplay and no test-only hook: write a valid
   save document with a known top 10 into `localStorage`, reload, open High scores and check the
   rows are drawn; change an option (which makes the game rewrite the whole document), reload, and
   check the document still holds the same names and the High scores screen still shows them.
   Names are drawn on the canvas, so the screen check compares painted text pixels in the table
   rows with an empty table, not glyphs.
3. **The frame-time measure runs in Chromium only** (the step is skipped elsewhere and annotated).
4. **Local only.** `make smoke` runs the three engines; CI is unchanged (ADR-0007): no browser
   install and no E2E job in CI. The engines are installed once with
   `pnpm exec playwright install chromium firefox webkit`.
5. **The build runs before the server**, and the `webServer` command starts `vite preview`
   directly, so Playwright stops the server it started and no process is left on port 4173.

## Rejected

- *Playing to a real game over, then typing a name* (MCDA 300/500): end to end, but a full run per
  engine whose length depends on enemy timing — slow and flaky. The write path from name entry is
  covered by unit tests.
- *A test-only URL parameter that opens the name entry* (350/500): it would ship in the bundle and
  become public surface (ADR-0025, decision 2).
- *Seed and reload without an options change* (430/500): proves the read, not a real write by the
  game.
- *The three engines in CI* : contradicts ADR-0007 and adds browser installs to every run.

## Consequences

- `playwright.config.ts` gains two projects and a changed `webServer`; the smoke file gains the
  persistence step and a Chromium guard on the CDP measure. `make smoke` takes about three times
  longer.
- A failure in Firefox or WebKit is a release blocker like one in Chromium.
- Private browsing modes that refuse `localStorage` are already handled (the session goes on
  without saving, UC3 3a) and are not tested in the browser.
