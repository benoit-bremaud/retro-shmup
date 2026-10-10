# ADR-0018: Device input after the enemies brick — pause button, taps, takeover and rounding

**Status:** Accepted — 2026-10-11. **Partially supersedes ADR-0015**: decision 3 (the screen is
read through `ScreenLayoutSource`, which `RenderPort` extends), decision 4 (what the environment
record carries in the devices brick), decision 5 (how starts are ordered, when the mouse starts),
decision 7 (stick rounding, the fixed gamepad roles) and decision 8 (listener target, tap
priority, pointer edge cases). Every other part of ADR-0015 stands. The values used here are GDD
v0.7 §4.2, §4.4, §9.1 and §9.2 *(initial)* values.

## Context

- ADR-0015 was written before the enemies brick. That brick gave the HUD contents (score,
  multiplier, chain bar, reserve lives), added `Paused`, `Count-in` and an arcade `Game over`,
  and moved the touch pause button into the devices brick (C2).
- Since then the pause and Game over exits accept only `Confirm` or `Back`, which touch and mouse
  cannot produce; gamepad `Start` is `Pause`, which the pause ignores by design; `A` is both fire
  and `Confirm`, so hammering fire could skip Game over.
- The C2 conception study (2026-10-11) found further gaps: a mouse brush or a click on the pause
  button takes the ship; a stick rounded to the nearest 1/256 can exceed length 1; one intent
  frame carries one tap; a rotation mid-run leaves a stale tap and steering finger; reading the
  canvas rectangle on every event allocates and forces layout. The owner validated each GDD v0.7
  rule one at a time with a scored recommendation, and the technical batch below as a whole.

## Decision

1. **The domain hit-tests the pause button.** `ScreenLayoutSource { layout(): ScreenLayout }` is
   extracted now (ADR-0015 consequence) and `RenderPort` extends it. The pause rectangles —
   portrait {192, 0, 48, 32}, landscape {432, 0, 48, 48}, in `hud` coordinates — are data in
   `hud-layout.ts`, next to the HUD layouts (`HUD_LAYOUTS` keyed by `layout.kind`). A pure
   `isPauseTap(frame, layout)` lives beside them: one source for drawing and hit-testing. The
   scene machine treats a pause tap as `Pause` in `Playing` (before the run steps) and in
   `Count-in`; the intent frame is never mutated.
2. **Taps.** A `hud` tap replaces a pending `field` tap within one read; within one region the
   first tap wins. A finger landing on the HUD never steers and never bombs. In `Paused`, any tap
   starts the count-in (interim, until the pause menu); in `Game over`, a tap or `Confirm`
   returns to the title after `SceneTuning.gameOverLockSeconds` (1 s).
3. **Fixed gamepad roles.** Button 0 (`A`) is `Confirm`, 1 (`B`) is `Back` and 9 (`Start`) is
   also `Confirm`, besides their bindings, in every scene (`Playing` ignores `Confirm` and
   `Back`). The automatic pause still sets `Pause` only, so it never resumes.
4. **Mouse takeover.** A mouse move counts as a movement start only when its floored logical
   position changes; a button down on the field starts the movement, a button down outside the
   field is a tap only. The canvas shows a crosshair cursor.
5. **Rounding.** Pointer targets and taps are floored to whole logical pixels (the target is then
   raised by the touch offset). The stick, after the radial dead zone, the rescale and the clamp
   to length 1, is quantized to 1/256 **toward zero** per component, so its length never exceeds
   1 and a full tilt never outruns the keyboard.
6. **Listeners and geometry.** `pointerdown`, `pointermove`, `pointerup` and `pointercancel` are
   listened to on the page; a down outside the canvas rectangle is nothing. The composition root
   reads the canvas client rectangle once per resize, after sizing the canvas, and passes plain
   numbers to `DeviceInput.resize(layout, rect)`; no event reads the DOM. The screen is
   recomputed on `resize` and when the device pixel ratio changes (a `matchMedia` resolution
   query, re-registered on each change). `Viewport` carries the layout; on `resize` the renderer
   resets its region and camera without `restore()` (resizing a canvas resets its state).
7. **Layout change.** When the layout kind changes, `DeviceInput.resize` drops the pending tap,
   releases the steering finger and sets `Pause` (GDD v0.7 §9.1). The run is never restarted.
8. **Pointer edge cases.** A pen counts as touch. `pointercancel` is a release of the steering
   finger with no tap. `isPrimary` is never used ("first finger" means no finger is steering).
   Mouse buttons are read from changes of `buttons` on down, move and up, since a second button
   pressed while one is held arrives as a `pointermove`.
9. **Ordering and tuning.** The façade keeps one increasing sequence number; each movement start
   and each input event takes the next one, and a gamepad start found by the poll in `read()`
   takes it last. The pure `arbitrate(state, keys, pointer, pad, into)` compares these numbers —
   no timestamps, no queue, no allocation. `InputTuning` (touch offset 32, stick dead zone 0.2,
   256 stick steps) lives in `src/domain/input/`, next to `DEFAULT_BINDINGS`.
10. **Page.** `touch-action: none` on `html`, `body` and the canvas; no text selection, callout or
    tap highlight; `overscroll-behavior: none`; the body height is `100dvh`, `100%` as fallback;
    the context menu is suppressed on the page.

## Alternatives considered

Scored in the C2 study on GDD fidelity, phone usability, ADR constraints, KISS, testability and
cost; the owner validated the top scores.

- **The adapter hit-tests the pause button and sets `Pause`** — rejected: it duplicates the
  layout knowledge and contradicts ADR-0009 ("the domain hit-tests tapX/tapY itself").
- **A new tap region `'pause'`** — rejected: it changes the port for one button.
- **Only the pause button resumes; `Start` keeps doing nothing in the pause** — rejected: hard to
  discover on a phone, against the console habit.
- **No Game over lock** — rejected: hammering fire skips the GAME OVER.
- **Any mouse move or click takes the ship** (ADR-0015 as written) — rejected: a desk bump or a
  click on the pause button sends the ship flying.
- **Stick rounded to the nearest step** (ADR-0015 as written) — rejected: (0.6, 0.8) gives a
  length of 1.0013, faster than the ship's maximum.
- **Listeners on the canvas only** — rejected: the mouse is lost in the letterbox, and a finger
  there can pinch or pull to refresh.
- **`getBoundingClientRect()` per event** — rejected: an allocation and a layout per move.
- **Event timestamps to order starts** — rejected: they need a queue and are not comparable with
  the gamepad poll.

## Consequences

- C2 ships in five PRs (owner decision): this design, the pure arbitration, the portrait layout,
  touch and mouse with the pause button, then the gamepad. Each merge deploys a coherent game.
- The single smoke test (ADR-0003) runs a phone in portrait (390 × 844, pixel ratio 2, touch):
  start by a HUD tap, pause by the button, resume by a tap; then a landscape window, where the
  automatic pause shows, and a keyboard resume proves the run was not restarted.
- The portrait HUD uses 4 px margins (the landscape bands keep 8 px).
- Until the bombs of the pickups brick, the second-finger and right-button `Bomb` is wired with no
  effect.
- Fractional pixel ratios (1.25, 2.625) can resample the canvas by about 1 px; positioning it on
  whole device pixels is the fix if a device shows it.

## References

- GDD v0.7 §4.2, §4.4, §9.1, §9.2; ADR-0003, ADR-0009, ADR-0012, ADR-0014, ADR-0015;
  `docs/architecture/diagrams/meta/05-state-scenes.md` (C2 additions); issue #9.
