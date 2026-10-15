# Local review — retro-shmup (docs/sprites)

- Date: 2026-10-15
- Commit: 95f4c6f + review fixes
- Scope: branch diff main...HEAD (GDD v0.17 §3.2.1, ADR-0001 amendment, UML render/\*)
- Checks run: design · docs (tests, security, correctness: not applicable — no code in the diff)
- Verdict: ship after fixes · Must 3 (fixed) · Should 7 (fixed) · Nice 3

## 🔴 Must Have

- `docs/architecture/diagrams/gameplay/04-class-domain.md:368,461` `[docs]` · `EnemyStats.sprite`
  and `brokenPart: SpriteId` contradicted `SPRITE_OF_ROLE` (ADR-0010) · fixed: field removed,
  `brokenPart: BrokenPart` as in the code.
- `docs/architecture/diagrams/render/*.md` `[docs]` · Mermaid generics with commas and a `;` in a
  note broke parsing · fixed: plain text, both diagrams render with mermaid-cli 11.4.2.
- `docs/decisions/ADR-0001-…md:42,47` `[docs]` · the frozen sketch still read `string` / `void` ·
  fixed: pointer to the amendment.

## 🟡 Should Have

- `render/04-class-sprites.md` `[design]` · cell centre vs ship centre · fixed: whole cells, ships
  measured centred within half a pixel, bake test planned.
- `render/04-class-sprites.md` `[design]` · centre vs top-left convention and rounding · fixed:
  documented, rounded as `fillLogical`.
- `render/04-class-sprites.md` `[design]` · code changes implied (renderer no longer throws,
  recording double returns a configurable boolean, `'ship'` test id) · fixed: listed.
- `ADR-0001` `[design]` · "its sheet" vs both sheets baked together · fixed.
- `game-design-document.md:393` `[docs]` · "full sprite (32 × 32)" · fixed: "sprite box".
- GDD §3.2.1 `[docs]` · the Heavy also overhangs (64 over 56) · fixed: overhang bullet.
- `render/04-class-sprites.md` `[docs]` · abbreviated renderer signature · fixed: noted.

## 🔵 Nice to Have

- `ADR-0001` `[design]` · `frame` / `flipX` unused since 2026-10-07 · left as the ADR says (YAGNI
  candidate for a later cleanup).
- GDD decision record v0.6 row "full-box hitboxes" · historical, left.
- `02-sequence-sprite-loading.md` `[docs]` · sheet sizes ≈ 2 / 4 KB unverified until the PNGs land.

## ⚪ Disagree / Intentional

- `render/04-class-sprites.md` `[design]` · "turret tile narrower than `CRUISER_TURRET`, empty
  hittable space" · the turret has no hitbox of its own; it sits inside the Cruiser's 112 × 48 box,
  and `CRUISER_TURRET` only places the debris. Noted in the diagram.
- `drawSprite` returning `boolean` (command + answer) · owner MCDA A 475/500, ADR-0001 amendment.

## Per-dimension summary

- Design: sound, no over-engineering; spec gaps fixed · Docs: consistent numbers and links; three
  freshness/syntax fixes · Tests / Security / Correctness: no code changed.
