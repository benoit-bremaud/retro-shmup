# ADR-0028: Pixel country flags beside the code, from one CC0 sheet

**Status:** Accepted — 2026-10-19. **Extends ADR-0001** (the `RenderPort` gains `drawFlag`) and
**ADR-0021** (the country code is shown with its flag). Values are GDD v0.27 values (§9.1
*Country flags*, §9.3). Issue #125.

## Context

- Since v0.26 the player's country is a two-letter code chosen once on the letter grid and shown
  in the options, the High scores and the country choice (ADR-0027 decision 6). A code alone
  says little to a child or a tester who does not know ISO codes (owner, 2026-10-19).
- Emoji flags are not an option: Windows draws none (it shows the two letters), and they are
  not pixel art.
- A flag picker replacing the letters would need a scrolling grid of ~250 cells, against the
  no-scrolling rule of the menus.
- The domain never imports the browser (CLAUDE.md); the sprites already come from baked sheets
  behind `RenderPort.drawSprite`, which returns whether it drew (ADR-0001, 2026-10-15 amendment).
- `COUNTRY_CODES` holds the 249 officially assigned ISO 3166-1 alpha-2 codes; a few territories
  (BV, SJ, HM, UM, BQ, AQ) have no flag of their own.

## Decision

1. **The letter grid stays the way to choose**; a 16 × 11 flag is drawn **2 px right of the
   code** wherever the code is shown: the options' *Country* row, each High scores row (code at
   x 104, flag at x 122), the country choice once the code is complete and known. The far-
   background champion name stays a name only (GDD §9.4.1).
2. **One CC0 sheet**: the famfamfam 16 × 11 flags (Mark James, CC0 / public domain, as published
   on OpenGameArt), packed once by a development script into `public/assets/sprites/flags.png`
   with an index of the cell of each code. The script is not part of the build; the sheet and the
   index are committed, credited in `CREDITS.md`.
3. **Fallback**: a territory without a flag of its own maps to its parent's cell in the index
   (BV and SJ → NO, HM → AU, UM → US, BQ → NL); a code with no cell (AQ, or any flag missing from
   the set), or a sheet not loaded yet or failed, draws nothing — the code alone is shown, never a
   placeholder box.
4. **Port**: `RenderPort.drawFlag(code: string, x: number, y: number): boolean`, top-left
   coordinates like `drawText`, `true` when drawn. The domain passes the code it already holds;
   it knows no image, no cell and no alias. The Canvas 2D adapter loads and bakes the sheet like
   the sprite sheets and looks the code up in a `Map` built once at load: no allocation per frame.
5. **No switch**: a flag never flashes nor moves, so it is not a game-feel effect.

## Consequences

- One more PNG of ~250 cells of 16 × 11 (a few tens of kB) loaded at boot, like the sprites.
- Frozen set: a flag changed since the set was drawn needs a hand edit of its cell; the index
  makes the missing ones explicit and a unit test checks every allowlisted code either has a cell
  or is on the code-alone list.
- Tests mock the port: the overlays call `drawFlag` with the code at the documented position; the
  adapter test checks the alias and the missing-code fallback.
- The High scores keep their columns; the options row and the country choice centre the text and
  the flag as one line.

## Rejected alternatives

- **A flag picker grid replacing the letters** (235/500): needs scrolling.
- **Codes only** (390/500): unchanged, less readable.
- **Emoji flags**: none on Windows, not pixel art.
- **flag-icons (MIT) SVG rasterised to 16 × 11** (340/500): complete but blurry at that size.
- **Flags drawn in code from band and shape data** (350/500): no asset, but ~250 specifications
  and poor emblems.
- **The flag left of the code** (395/500): a missing flag leaves a hole or breaks the code column.
- **A dimmed colour flag (380/500) or a bright one (310/500) in the far-background name**: a colour
  spot in a one-colour decoration layer that must never compete with play.
