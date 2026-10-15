# Local review — retro-shmup (feat/render-sprites, G4-1a)

- Date: 2026-10-15
- Commit: 6815aa6 + review fixes
- Scope: branch diff main...HEAD (`SpriteBank`, `sprite-atlas`, `drawSprite` returning `boolean`,
  `SPRITE_IDS`, sheet loading in `main.ts`, Kenney sheets, `CREDITS.md`, `public/assets/LICENSE.md`)
- Checks run: design + drift (architecture-guardian) · tests (test-auditor) · security (read-only
  `security-policy` pass) · correctness (manual mutations, headless load check)
- Verdict: ship after fixes · Must 0 · Should 6 (fixed) · Nice 4

## 🔴 Must Have

_None._

## 🟡 Should Have

- `src/adapters/sprite-bank.ts` `[design|correctness]` · a canvas failing midway left a partial bank
  (sprites and shapes mixed) · fixed: staged map, all or nothing; test added.
- `docs/architecture/diagrams/render/04-class-sprites.md` `[design]` · drift: `get` returns
  `BakedSprite` (canvas and size), not the canvas · fixed: UML updated (`BakedSprite`, `BakeCanvas`,
  `SPRITE_IDS`, `SheetId`); sequence diagram aligned.
- `tests/adapters/canvas2d-renderer.test.ts` `[tests]` · no HUD-region sprite case · fixed.
- `tests/adapters/canvas2d-renderer.test.ts` `[tests]` · the drawn image's identity unchecked ·
  fixed: own stand-in per baked sprite, asserted.
- `tests/adapters/canvas2d-renderer.test.ts` `[tests]` · expected position re-derived with the
  implementation's formula · fixed: literal coordinates.
- `tests/support/recording-render.ts` `[tests]` · sprite recording with no consumer yet · removed
  (YAGNI); G4-1b adds what its presenter tests need.

## 🔵 Nice to Have

- `src/adapters/canvas2d-renderer.ts` `[correctness]` · `offscreen.imageSmoothingEnabled` resets on
  resize; harmless (1:1 whole-pixel copies) · left.
- `src/app/main.ts` `[correctness]` · `BASE_URL` without a trailing slash would break the path;
  Vite normalises it · left.
- `src/domain/ports/render-port.ts` `[design]` · `frame` / `flipX` still unused (ADR-0001) · left.
- `tests/adapters/sprite-bank.test.ts` `[tests]` · a second `bake` is untested (it overwrites) ·
  left.

## ⚪ Disagree / Intentional

- `drawSprite` both draws and answers · owner MCDA A 475/500, ADR-0001 amendment.
- `newCanvas` / `BakeSurface` injection · the seam that lets the bake run in Node (ADR-0011).

## Per-dimension summary

- Design: dependency rule held, no over-engineering, one drift fixed in the UML · Tests: 1 223
  green; mutations planted in atlas, bank and renderer all caught (one equivalent mutant) ·
  Security: same-origin images only, CSP `img-src 'self'` unchanged, no new sink, CC0 licence
  recorded · Correctness: both sheets load (200) and bake with no warning in a headless build.
