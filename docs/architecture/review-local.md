# Local review — retro-shmup (feat/presenter-sprites, G4-1b)

- Date: 2026-10-15
- Commit: e2eebdd + review fixes
- Scope: branch diff main...HEAD (`RunPresenter` sprites with shape fallback, `SPRITE_OF_ROLE`,
  the Cruiser composite, the white flash silhouette, GDD/ADR/UML amendments, doc pass)
- Checks run: design + drift (architecture-guardian) · tests (test-auditor) · security (read-only
  `security-policy` pass) · correctness (manual mutations, headless captures)
- Verdict: ship after fixes · Must 0 · Should 5 (fixed) · Nice 4

## 🔴 Must Have

_None._

## 🟡 Should Have

- `docs/architecture/diagrams/render/04-class-sprites.md` `[design]` · drift: the fallback is
  decided by the first wing's draw, not the hull's · fixed.
- `docs/architecture/diagrams/render/02-sequence-sprite-loading.md` `[design]` · drift: the flash
  silhouette, the `frame` argument and the white-box fallback were missing · fixed.
- `tests/domain/run-presenter.test.ts` `[tests]` · the cockpit's position and its order after
  the sprite were unchecked · fixed (`RecordingRender.order`).
- `tests/domain/run-presenter.test.ts` `[tests]` · a flashing Cruiser in phase 2 untested ·
  fixed.
- `tests/domain/run-presenter.test.ts` `[tests]` · the hit flash switched off with sprites loaded
  untested (photosensitivity option) · fixed.

## 🔵 Nice to Have

- `src/domain/presentation/run-presenter.ts` `[design]` · both wings use one unmirrored sprite;
  the pack's ship is symmetric (headless capture) · left.
- `src/adapters/canvas2d-renderer.ts` `[design]` · any `frame` but 1 draws the plain sprite; a
  union type would be stricter (YAGNI) · left.
- `tests/domain/run-presenter.test.ts` `[tests]` · the enemy cases use alpha 1 (interpolation is
  covered by the ship case) · left.
- `tests/domain/run-presenter.test.ts` `[tests]` · the role cases filter field rects with the
  player dead; exact, since the dead ship draws nothing · fixed in passing.

## ⚪ Disagree / Intentional

- The flashing Cruiser keeps its turret silhouette on the sprite path while the box path drops
  it · the sprite path draws what is there; matches the amended UML.

## Per-dimension summary

- Design: no over-engineering, dependency rule held, two doc drifts fixed · Tests: 1 241 green;
  planted mutations in presenter, bank and renderer all caught (one equivalent: turret offsetX
  is 0) · Security: no new input, sink or network call; same-origin images only · Correctness:
  headless captures show the sprites at 9 s and 20 s, the Cruiser as white silhouettes under
  fire, and the shapes when the sheets are blocked (one `console.warn`, no error to the player).
