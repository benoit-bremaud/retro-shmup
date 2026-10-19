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

## Flag icons (famfamfam, Mark James)

- Files: public/assets/sprites/flags.png
- Author: Mark James (www.famfamfam.com)
- Source: https://github.com/legacy-icons/famfamfam-flags (dist/png, branch master)
- Licence: public domain ("free for any use", per the set's LICENSE.md)
- Modifications: the 240 flags of `COUNTRY_CODES` packed into one 16 × 11 sheet by
  `scripts/build-flag-sheet.py`, CH, NP centred and ME cropped to 16 × 11; `gg.png` left out (a
  CC-BY 2.5 add-on)

## NES Shooter Music (5 tracks, 3 jingles) (SketchyLogic)

- Files: public/assets/audio/*.mp3
- Author: SketchyLogic
- Source: https://opengameart.org/content/nes-shooter-music-5-tracks-3-jingles
- Licence: CC0-1.0
- Modifications: encoded from the pack's `WAV.zip` to mono MP3 at 96 kb/s, metadata stripped,
  renamed by use: `Map` → `title`, `Mercury` → `level-1`, `BossIntro` → `boss-intro`,
  `BossMain` → `boss-loop`, `Win Jingle` → `results`, `Warp Jingle` → `game-over`

The slice's music (GDD v0.23 §9.5), to be replaced by custom tracks in the custom-asset phase.

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

- **The game's own sfxr-style synthesiser** (`src/domain/audio/synth.ts`, MIT with the code) —
  renders the sound effects of GDD §9.5 when audio unlocks; no third-party generator.
- **[FFmpeg](https://ffmpeg.org/)** (LAME encoder) — encoded the music to MP3. Not shipped.
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
