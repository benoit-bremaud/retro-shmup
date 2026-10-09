# ADR-0015: Device input in practice and the portrait screen

**Status:** Accepted — 2026-10-08. **Partially supersedes ADR-0014**: decision 6 (portrait phones
deferred) is decided here, and decisions 1 to 4 (one 480 × 320 logical screen, its regions, its
off-screen surface and its scale) now apply to the landscape screen only. Refines ADR-0009
decision 1 (which device "wins", what the touch and gamepad adapters produce, the latching
guarantee for gamepad buttons) and decision 2 (which events are gestures). The tunable values
these mechanisms use (touch offset, stick dead zone) are GDD v0.5 §4.2 *(initial)* values.

## Context

- ADR-0014 decision 6 left the portrait-phone layout to be "decided with touch input". GDD §3.1
  and §9.2 ask for a letterboxed play field and a HUD collapsed into a top strip on narrow
  screens. With the 480 × 320 screen, a phone 390 CSS px wide at a pixel ratio of 3 gets scale ×2:
  the play field is about 160 CSS px wide, two fifths of the screen width.
- ADR-0009 fixes the intent frame but leaves open how four devices combine ("last device used
  wins"), how the stick and the touch target are computed, and which browser events count as
  gestures. GDD v0.4 §4.2 gave `Space` to both the keyboard fire and the mouse bomb.
- ADR-0014 decision 7 lets only `src/app/main.ts` touch `window`, `document`,
  `requestAnimationFrame` and `Math.random`; ADR-0009 decision 2 puts the event listeners in the
  input adapter; ADR-0011 tests adapters in Node with injected doubles, without a DOM emulator.
- The Gamepad API is polled, not event-driven, and `navigator.getGamepads()` returns a new array.

## Decision

1. **Two logical screens, one play field** (sizes: GDD §3.1).
   - **Landscape, 480 × 320** (ADR-0014): the field at (120, 0), HUD bands left and right.
   - **Portrait, 240 × 352**: the field at (0, 32), a 240 × 32 HUD strip above it.
   - **Choice.** `computeViewport` (`src/adapters/viewport.ts`, a pure function) applies
     ADR-0014's scale formula to both sizes, in device pixels. A screen **fits** when its unclamped
     scale is at least 1. Among the screens that fit, the larger integer scale wins, and a tie keeps
     landscape (GDD: desktop first). When neither fits, the one with the larger unclamped scale is used at ×1.
   - The composition root calls it on every resize, rotation included, resizes the off-screen
     canvas, then hands the result to the renderer and the input adapter in the same handler, so
     the two never disagree.
   - The field is 240 × 320 in both, so the simulation and every play-field coordinate are the
     same; only presentation and input mapping change.
2. **Regions per screen.** `setRegion('field')` puts the origin at the field's top-left and
   clips to 240 × 320; `setRegion('hud')` puts it at the logical screen's top-left, unclipped.
   Screen shake moves field draws only (ADR-0014).
3. **The domain reads the screen through the render port.** `RenderPort` gains
   `layout(): ScreenLayout`, returning one of two constant records, `LANDSCAPE` and `PORTRAIT`,
   defined in `src/domain/presentation/screen.ts`. They replace `FIELD_X`, `SCREEN_WIDTH` and
   `SCREEN_HEIGHT`; only `FIELD_WIDTH` and `FIELD_HEIGHT` stay shared constants.

   ```ts
   export interface ScreenLayout {
     readonly kind: 'landscape' | 'portrait';
     readonly width: number;  // logical screen
     readonly height: number;
     readonly fieldX: number; // field origin in the logical screen
     readonly fieldY: number;
   }
   ```

   - The HUD, the title, the menus and the touch buttons place themselves from it. GDD §9.2
     requires two HUD arrangements, which satisfies ADR-0001's rule for a new port method.
   - `layout()` is read by the scenes and the presenter, **never by `Run`**: the simulation stays
     independent of the screen.
4. **Input adapter structure and injected browser objects.**
   - `DeviceInput` is the single `InputPort` implementation, a **façade** over internal modules:
     `keyboard`, `pointer` (touch and mouse) and `gamepad`. Each module fills its own
     preallocated sample; there is no interface shared by the devices, which differ by nature
     (event-driven or polled).
   - The arbitration of decision 5 is one **pure function** over those samples, with no browser
     type, unit-tested without event doubles. The façade owns the listeners, press latching, the
     automatic `Pause`, the gestures and the key capture.
   - `DeviceInput` never references a browser global. The composition root passes it **one
     environment record** of narrow structural interfaces: the key and focus event target, the
     canvas as pointer target and its client rectangle, a gamepad source, the page visibility and
     fullscreen accessors, and the audio unlock hook (ADR-0009). A lint rule, added with
     `DeviceInput`, forbids `window`, `document`, `navigator` and `requestAnimationFrame` in
     `src/adapters`.
5. **Several devices at once.**
   - **Movement** belongs to one device at a time. A device takes it when it starts producing
     movement — a direction key or d-pad button going down, the stick leaving its dead zone, a
     finger landing on the field, a mouse move over the canvas or a mouse button — and keeps it
     until another device starts. While the owner produces no movement (keys released, finger
     lifted), `moveKind` is `none` and the ship stays; no other device takes over by itself.
   - **Order within one read.** Event-driven starts (keyboard, pointer) apply in event order; a
     gamepad start, found by the poll in `read()`, applies last.
   - **Buttons** of every device combine (bitwise OR), except that the always-on `Fire` of touch
     and mouse (ADR-0009) applies only while touch or mouse owns the movement, finger lifted
     included. A keyboard player who brushes the mouse gets autofire until a key or the stick
     moves the ship again, never longer.
   - **Lost focus.** On blur or a hidden page the adapter clears every held key and button and the
     movement owner, then sets `Pause` in `pressed` (ADR-0009). No key release is ever missed. The
     gamepad's previous poll is kept, so a pad button still held on return is not a new press.
   - `device` is the last device with any input; it drives prompts and labels only, never an
     outcome.
6. **Keyboard.** Physical keys (ADR-0012). Opposite directions held together cancel to 0;
   auto-repeated `keydown` events are not presses; `Enter` and `NumpadEnter` are the fixed
   `Confirm`; `Esc` is the fixed `Pause` + `Back`. The adapter prevents the browser's default
   action for bound keys, so arrows and `Space` never scroll the page.
7. **Gamepad.**
   - Only pads reporting the `standard` mapping are read; the active pad is the last one with
     input.
   - The adapter polls in `read()`, once per step, and finds presses by comparing with the
     previous poll. A press shorter than one step can be missed: the API offers no events for
     buttons.
   - The active pad is lost when it is missing from the poll or reports `connected: false`; that
     sets `Pause` in `pressed` (ADR-0009).
   - The stick goes through a radial dead zone, rescaled to start at 0, clamped to length 1 and
     quantized to 1/256 (ADR-0009), each component rounded to the nearest step; its length sets
     the speed. The d-pad wins over the stick.
   - `getGamepads()` allocates inside the browser on each call; the adapter's own code allocates
     nothing per step.
8. **Touch and mouse use Pointer Events.**
   - Pointer positions are mapped to the logical screen with the canvas client rectangle and the
     layout. A pointer going down in the field rectangle is a `field` tap; anywhere else on the
     canvas, a `hud` tap; outside the canvas, nothing. Tap coordinates are floored.
   - **Touch.** The first finger down on the field drives the ship: the target is the finger's
     point raised by the GDD offset, in play-field pixels. Its moves are mapped wherever they
     fall, outside the field or the canvas included; the domain clamp holds the ship. Lifting it
     leaves `moveKind = 'none'`, so the ship stays; a finger still down does not take over, a new
     first finger on the field does. A finger that comes down on the field while another drives
     the ship sets `Bomb` in `pressed`. A touch that starts outside the field is a tap only, never
     a move and never a bomb: the HUD region is where the touch buttons live.
   - **Mouse.** The target follows the cursor, mapped wherever it is; the domain clamp holds the
     ship. The right button sets `Bomb`; the left button is a tap. The canvas suppresses the
     context menu and sets `touch-action: none`.
   - **Gestures** (ADR-0009 decision 2) are the events browsers accept as user activation:
     `keydown` except `Esc`, `pointerdown` from a mouse, `pointerup` from a finger or a pen.
9. **Default bindings** (ADR-0012 shapes), in `DEFAULT_BINDINGS` in `src/domain`, pushed by the
   composition root through `setBindings` at boot and reused later by the save document and
   "restore defaults":

   | Intent | Keyboard primary | Keyboard secondary | Gamepad primary | Gamepad secondary |
   |---|---|---|---|---|
   | moveUp | `ArrowUp` | `KeyW` | 12 | `null` |
   | moveDown | `ArrowDown` | `KeyS` | 13 | `null` |
   | moveLeft | `ArrowLeft` | `KeyA` | 14 | `null` |
   | moveRight | `ArrowRight` | `KeyD` | 15 | `null` |
   | fire | `Space` | `KeyZ` | 0 (A) | `null` |
   | bomb | `KeyX` | `ShiftLeft` | 1 (B) | `null` |
   | pause | `KeyP` | `null` | 9 (Start) | `null` |

   Fixed keys are in decision 6; on the gamepad, buttons 0 and 1 are also `Confirm` and `Back` in
   menus (GDD §4.2).

## Alternatives considered

- **480 × 320 everywhere** — rejected: on a phone in portrait the play field stays small (about
  160 of 390 CSS px), against GDD §3.1 and §9.2.
- **Deferring the portrait screen again** — rejected: touch would ship barely usable on the
  devices it exists for.
- **Larger clamped scale wins, ties to landscape** (the first wording of decision 1) — rejected:
  when both scales clamp to ×1, landscape wins and overflows a narrow window that portrait fits.
- **Strict "last device wins" for the whole frame** — rejected: pressing a key while holding the
  stick would drop the stick's movement for that frame.
- **Always-on fire from touch and mouse whatever moves the ship** — rejected: one mouse nudge would
  pin firing on for a keyboard player.
- **`Space` as the mouse bomb** — rejected: it is the keyboard fire, a remappable binding, and the
  mouse is not remappable (GDD §4.2).
- **Stick normalized to constant speed** — rejected: removes fine control; eight-direction
  quantization was already rejected by ADR-0009.
- **Relative touch drag** — rejected: GDD §3.1 and §4.2 say the ship follows the finger.
- **Touch offset in CSS pixels or millimetres** — rejected: it would vary with the scale; a value
  in play-field pixels keeps input mapping deterministic and testable.
- **Browser globals in the input adapter** — rejected: it would bend ADR-0014 decision 7 and need a
  DOM emulator in tests.
- **One input adapter class, or one adapter per device behind a merger** — rejected: the first
  gathers eight reasons to change in one class; the second needs a shared device interface the
  event-driven and polled devices cannot honestly share.

## Consequences

- On a layout change the composition root resizes the off-screen canvas, outside the game loop,
  and calls the renderer's concrete `resize(viewport, layout)`; the renderer resets its region to
  `hud` and its camera offset, since resizing a canvas resets its 2D context.
- The HUD has two arrangements; each HUD element is placed from `layout()`.
- When the scenes need `layout()` to hit-test touch buttons, a narrow `ScreenLayoutSource`
  interface is extracted from `RenderPort`, so simulation-side code does not depend on drawing.
  Not before.
- When the canvas meets the screen's bottom edge, the bottom of the field may be out of the
  thumb's reach with the touch offset: a point to watch in playtests.
- ADR-0001's sentence giving `Canvas2DRenderer` sole access to `document` is read through
  ADR-0014 decision 7 and decision 4 above: no adapter references `window`, `document`,
  `navigator` or `requestAnimationFrame`; the composition root injects the canvas, event targets
  and accessors. Other browser APIs (`performance`, Web Audio, Web Storage) stay in their own
  adapters (ADR-0003).
- Tests implied: the layout choice across common viewports (desktop, windowed, phone portrait and
  landscape, tablet, both screens clamped); pointer mapping to field and HUD in both layouts; the
  touch offset; the arbitration function (stick and key together, start order within one read,
  mouse nudge during keyboard play, owner stops); opposite keys; auto-repeat; gamepad dead zone,
  clamp, quantization, press edges between polls and pad loss; held state cleared and `Pause`
  set on blur and hidden page; the default bindings.

## References

- GDD v0.5 §3.1, §4.1, §4.2, §9.2; ADR-0001, ADR-0002, ADR-0009, ADR-0011, ADR-0012, ADR-0014.
- HTML Standard, activation-triggering input events:
  https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
- W3C Pointer Events: https://www.w3.org/TR/pointerevents/
- W3C Gamepad, standard gamepad layout: https://w3c.github.io/gamepad/#remapping
- MDN, CSS `touch-action`: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
