# Credits

Every third-party asset and tool used by the game is credited here. The in-game credits screen
mirrors this file (ADR-0005): the two must stay in sync, and a PR that changes one changes the
other.

The game's code is under the [MIT License](LICENSE). Assets are not: each one keeps the licence
recorded in its entry below, and lives under `public/assets/` (governed by
`public/assets/LICENSE.md`, created with the first asset).

## Assets

## Pixel Shmup (Kenney), version 1.1

- Files: public/assets/sprites/ships.png, public/assets/sprites/tiles.png
- Author: Kenney (www.kenney.nl)
- Source: https://kenney.nl/assets/pixel-shmup
- Licence: CC0-1.0
- Modifications: none (the pack's packed tilemaps `ships_packed.png` and `tiles_packed.png`,
  renamed); the game scales some cells 2× and turns the player's ship nose up at load

Development placeholders (GDD §3.2.1), to be replaced by custom assets before release.

Entry format (ADR-0005, one entry per file or pack):

```text
## <pack or file name>
- Files: public/assets/<path or glob>
- Author: <name or handle>
- Source: <URL>
- Licence: <CC0-1.0 | CC-BY-4.0 | All rights reserved>
- Modifications: <none | what was changed>
```

## Tools

- **8-bit SFX generator** (jsfxr-style; named when chosen) — generates the sound effects listed in
  GDD §9.5. Licence recorded when chosen.
- **[Mermaid](https://mermaid.js.org/)** — UML diagrams under `docs/architecture/diagrams/`. MIT.

## Rule for contributors

A PR that adds or replaces an asset adds or updates its entry above, in the ADR-0005 format:

- **Licence** is one of `CC0-1.0`, `CC-BY-4.0` or `All rights reserved` (custom assets made for
  the game). Non-commercial and share-alike licences are refused: 1.0 is a commercial release.
  CC BY entries carry the attribution text the author asks for, verbatim.
- **Modifications** is always filled in (`none` or what changed: palette swap, resize, trim,
  re-export), because CC BY 4.0 §3(a)(1)(B) requires it and the register stays uniform.

Assets with an unclear licence, or one that does not allow redistribution in a published game,
are not merged.
