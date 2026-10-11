# ADR-0018: Device input after the enemies brick — pause button, taps, takeover and rounding

**Status:** Accepted — 2026-10-11. **Partially supersedes ADR-0015**: decision 1 (the screen is
also recomputed when the device pixel ratio changes, and `Viewport` carries the layout),
decision 4 (what the environment record carries in the devices brick), decision 5 (how starts
are ordered, when the mouse starts), decision 7 (stick rounding), decision 8 (listener target,
tap priority, mouse buttons, pointer edge cases), decision 9 (the fixed gamepad roles apply in
every scene and `Start` is also `Confirm`), and the consequence giving the renderer
`resize(viewport, layout)` (now `resize(viewport)`). ADR-0015 decision 3 stands as written:
`RenderPort` gains `layout()`. Every other part of ADR-0015 stands. Values are GDD v0.7 values
(§4.2, §4.4, §9.1, §9.2); interim deviations are recorded only in the scene machine
(`meta/05-state-scenes`, devices brick additions).

## Context

- ADR-0015 was written before the enemies brick. That brick gave the HUD contents (score,
  multiplier, chain bar, reserve lives), added `Paused`, `Count-in` and an arcade `Game over`,
  and moved the touch pause button into the devices brick (C2).
- Since then the pause and Game over exits accept only `Confirm` or `Back`, which touch and mouse
  cannot produce; gamepad `Start` is `Pause`, which the pause ignores by design; `A` is both fire
  and `Confirm`, so hammering fire could skip Game over and restart a run from the title.
- The C2 conception study (2026-10-11) found further gaps: a mouse brush, a pass over the HUD or a
  click on the pause button takes the ship; a stick rounded to the nearest 1/256 can exceed
  length 1; one intent frame carries one tap; a rotation mid-run leaves a stale tap and steering
  finger; reading the canvas rectangle on every event allocates and forces layout. The owner
  validated each GDD v0.7 rule and each review choice one at a time with a scored
  recommendation, and the technical batch below as a whole.

## Decision

1. **The domain hit-tests the pause button** with `RenderPort.layout()` (ADR-0015 decision 3).
   `ScreenLayoutSource` is not extracted: no consumer would depend on it alone; it comes with the
   first one. The pause rectangles (GDD §4.2 sizes, flush with the logical screen's top-right
   corner) and the HUD positions (`HUD_LAYOUTS`, keyed by `layout.kind`) are data in
   `hud-layout.ts`, with a pure `isPauseTap(region, x, y, layout)` beside them: one source for
   drawing and hit-testing. Rectangles are half-open (`x ≥ left && x < right`). `hud.ts` draws the
   whole HUD — the landscape bands or the portrait strip, the pause button and the contents; the
   scene machine only chooses when (scene traits). `hud` tap coordinates are logical-screen
   coordinates.
2. **Taps and confirm.** A `hud` tap replaces a pending `field` tap within one read; within one
   region the first tap wins. A finger landing on the HUD never steers and never bombs. Only the
   left mouse button makes taps; the right button sets `Bomb` only when pressed on the field and
   does nothing elsewhere. The scene rules for taps (pause button, resume, Game over, title) are
   in the scene machine.
3. **Fixed gamepad roles.** Button 0 (`A`) is `Confirm`, 1 (`B`) is `Back` and 9 (`Start`) is
   also `Confirm`, besides their bindings, in every scene (`Playing` ignores `Confirm` and
   `Back`). The roles belong to the indices, not to the bindings: they stay after any remap
   (ADR-0012 swaps never move them). The automatic pause still sets `Pause` only, so it never
   resumes.
4. **Mouse takeover.** A mouse move is a movement start only when its new floored point lies on
   the field and differs from the previous point (the first move after load always differs).
   A left button down on the field starts the movement; down outside the field it is a tap only.
   Once the mouse owns the movement, its target is mapped wherever the cursor is and the domain
   clamp holds the ship. The canvas shows a crosshair cursor.
5. **Rounding.** Pointer targets and taps are floored to whole logical pixels (the touch target is
   then raised by the touch offset). The stick, after the radial dead zone, the rescale and the
   clamp to length 1, is quantized toward zero per component, so its length never exceeds 1 and
   a full tilt never outruns the keyboard.
6. **Listeners and geometry.** `pointerdown`, `pointermove`, `pointerup` and `pointercancel` are
   listened to on the page; a down outside the canvas rectangle is nothing. The composition root
   reads the canvas client rectangle once per resize, after sizing the canvas, and passes plain
   numbers to `DeviceInput.resize(layout, rect)`; no event reads the DOM. The screen is
   recomputed on `resize` and when the device pixel ratio changes (a `matchMedia` resolution
   query, re-registered on each change). On `resize` the renderer resets its region and camera
   without `restore()`, since resizing a canvas resets its state.
7. **Layout change.** When the layout kind changes, `DeviceInput.resize` drops the pending tap,
   releases the steering finger and sets `Pause` (GDD v0.7 §9.1). The first `resize` at boot only
   sets the layout; a resize keeping the same kind keeps the steering finger and remaps it. The
   run is never restarted.
8. **Pointer edge cases.** A pen counts as touch. `pointercancel` is a release of the steering
   finger with no tap. `isPrimary` is never used ("first finger" means no finger is steering).
   Mouse buttons are read from changes of `buttons` on down, move and up, since a second button
   pressed while one is held arrives as a `pointermove`.
9. **Ordering and tuning.** The façade keeps one increasing sequence number; each movement start
   and each input event takes the next one, and a gamepad start found by the poll in `read()`
   takes it last. Starts decide the movement owner; the last input decides `IntentFrame.device`,
   which prompts and labels will read. The browser-free `arbitrate(state, samples, into)` compares
   these numbers — no timestamps, no queue, no allocation. `InputTuning` (the GDD §4.2 touch
   offset and dead zone, ADR-0009's stick steps) lives in `src/domain/input/`, next to
   `DEFAULT_BINDINGS`.
10. **Page.** `touch-action: none` on `html`, `body` and the canvas; no text selection, callout or
    tap highlight; `overscroll-behavior: none`; the body height is `100dvh`, `100%` as fallback;
    the context menu is suppressed on the page.

## Alternatives considered

Scored in the C2 study and the C2-0 review on GDD fidelity, phone usability, ADR constraints,
KISS, testability and cost; the owner validated the top scores.

- **Extracting `ScreenLayoutSource` now** — rejected: an interface with no client.
- **The adapter hit-tests the pause button and sets `Pause`** — rejected: it duplicates the
  layout knowledge and contradicts ADR-0009 ("the domain hit-tests tapX/tapY itself").
- **A new tap region `'pause'`** — rejected: it changes the port for one button.
- **The scene machine draws the bands, strip and button** — rejected: HUD knowledge split across
  two modules, and drawing inside the navigator (ADR-0010).
- **Only the pause button resumes; `Start` keeps doing nothing in the pause** — rejected: hard to
  discover on a phone, against the console habit.
- **No lock on Game over or on the title after it** — rejected: hammering fire skips the GAME OVER
  and restarts a run.
- **Any mouse move or click takes the ship** (ADR-0015 as written), or any pixel change even over
  the HUD — rejected: a desk bump, a pass toward the pause button or a click on it sends the ship
  flying.
- **The right button bombs everywhere, or is a tap outside the field** — rejected: a bomb wasted
  on the pause button, or a pause from a slipped right click.
- **Stick rounded to the nearest step** (ADR-0015 as written) — rejected: (0.6, 0.8) gives a
  length of 1.0013, faster than the ship's maximum.
- **Listeners on the canvas only** — rejected: the mouse is lost in the letterbox, and a finger
  there can pinch or pull to refresh.
- **`getBoundingClientRect()` per event** — rejected: an allocation and a layout per move.
- **Event timestamps to order starts** — rejected: they need a queue and are not comparable with
  the gamepad poll.

## Consequences

- C2 ships in five PRs (owner decision): this design, the browser-free arbitration, the portrait
  layout, touch and mouse with the pause button, then the gamepad. Each merge deploys a coherent
  game.
- The single smoke test (ADR-0003) runs a phone, then a rotation. In a 390 × 844 context at pixel
  ratio 2 with touch: the canvas has the portrait aspect; a tap on the HUD strip starts a run and
  the ship's colour reaches its portrait resting point; a tap on the pause button shows the
  `veil` colour on the field; a tap resumes and, after at least 60 frames, the veil is gone. Then
  a 1280 × 900 viewport: the landscape aspect, the veil again (the layout-change pause); `Esc`
  resumes and, after at least 60 frames, the ship's colour is at its last point and not at the
  fly-in spawn, which proves the run was not restarted; then the Popcorn check and the timing
  log.
- Until the bombs of the pickups brick, the second-finger and right-button `Bomb` is wired with no
  effect. Later landscape right-band items (level, weapon, shield) start below the pause button.
- Fractional pixel ratios (1.25, 2.625) can resample the canvas by about 1 px; positioning it on
  whole device pixels is the fix if a device shows it.

## References

- GDD v0.7 §4.2, §4.4, §9.1, §9.2; ADR-0003, ADR-0009, ADR-0010, ADR-0012, ADR-0014, ADR-0015;
  `docs/architecture/diagrams/meta/05-state-scenes.md` (devices brick additions); issue #9.
