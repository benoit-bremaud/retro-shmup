# ADR-0015: Device input in practice and the portrait screen

**Status:** Accepted — 2026-10-08. **Partially supersedes ADR-0014**: decision 6 (portrait phones
deferred) is decided here, and decisions 1 to 4 (one 480 × 320 logical screen, its regions, its
off-screen surface and its scale) now apply to the landscape screen only. Refines ADR-0009
decision 1 (which device "wins", what the touch and gamepad adapters produce, the latching
guarantee for gamepad buttons, and the consumption of `Pause` in play until the enemies brick)
and decision 2 (which events are gestures). The tunable values these mechanisms use (touch
offset, stick dead zone) are GDD v0.5 §4.2 *(initial)* values.

## Context

- ADR-0014 decision 6 left the portrait-phone layout to be "decided with touch input". GDD §3.1 and §9.2
  ask for a letterboxed play field and a HUD collapsed into a top strip on narrow screens. With
  the 480 × 320 screen, a phone 390 CSS px wide at a pixel ratio of 3 gets scale ×2: the play
  field is about 160 CSS px wide, two fifths of the screen width.
- ADR-0009 fixes the intent frame but leaves open how four devices combine ("last device used
  wins"), how the stick and the touch target are computed, and which browser events count as
  gestures. GDD v0.4 §4.2 gave `Space` to both the keyboard fire and the mouse bomb.
- ADR-0014 decision 7 lets only `src/app/main.ts` touch `window`, `document`,
  `requestAnimationFrame` and `Math.random`; ADR-0009 decision 2 puts the event listeners in the
  input adapter; ADR-0011 tests adapters in Node with injected doubles, without a DOM emulator.
- The Gamepad API is polled, not event-driven, and `navigator.getGamepads()` returns a new array.

## Decision

1. **Two logical screens, one play field.**
   - **Landscape, 480 × 320** (ADR-0014): the field at (120, 0), HUD bands left and right.
   - **Portrait, 240 × 352**: the field at (0, 32), a 240 × 32 HUD strip above it.
   - The composition root, through the pure viewport function, computes the integer scale of
     both, in device pixels, with ADR-0014's formula applied to each size, and uses the screen
     with the **larger scale**; a tie keeps landscape (GDD: desktop first). It re-evaluates on
     every resize, rotation included, and hands the chosen layout to the renderer and the input
     adapter.
   - The field is 240 × 320 in both, so the simulation and every play-field coordinate are the
     same; only presentation and input mapping change.
2. **Regions per screen.** `setRegion('field')` puts the origin at the field's top-left and
   clips to 240 × 320; `setRegion('hud')` puts it at the logical screen's top-left, unclipped.
   Screen shake moves field draws only (ADR-0014).
3. **The domain reads the screen through the render port.** `RenderPort` gains
   `layout(): ScreenLayout`, returning one of two constant records defined in the domain:

   ```ts
   export interface ScreenLayout {
     readonly kind: 'landscape' | 'portrait';
     readonly width: number;  // logical screen
     readonly height: number;
     readonly fieldX: number; // field origin in the logical screen
     readonly fieldY: number;
   }
   ```

   The HUD, the title, the menus and the touch buttons place themselves from it. GDD §9.2
   requires two HUD arrangements, which satisfies ADR-0001's rule for a new port method. The
   input adapter maps pointers with the same layout, computed once per resize by the composition
   root and handed to both adapters.
4. **Browser objects are injected.** `DeviceInput` never references a browser global: the
   composition root passes it narrow structural interfaces — the key and focus event target, the
   canvas as pointer target and its client rectangle, a gamepad source, the page visibility and
   fullscreen accessors — as it passes `Canvas2DRenderer` its contexts. A lint rule, added with
   `DeviceInput`, forbids `window`, `document`, `navigator` and `requestAnimationFrame` in
   `src/adapters`.
5. **Several devices at once.**
   - **Movement** belongs to one device at a time. A device takes it when it starts producing
     movement — a direction key or d-pad button going down, the stick leaving its dead zone, a
     finger landing on the field, a mouse move over the canvas or a mouse button — and keeps it
     until another device starts. While the owner produces no movement (keys released, finger
     lifted), `moveKind` is `none` and the ship stays.
   - **Buttons** of every device combine (bitwise OR), except that the always-on `Fire` of touch
     and mouse (ADR-0009) applies only while touch or mouse owns the movement, finger lifted
     included. A keyboard player who brushes the mouse gets autofire until a key or the stick
     moves the ship again, never longer.
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
     buttons. Losing the active pad sets `Pause` in `pressed` (ADR-0009).
   - The stick goes through a radial dead zone, rescaled to start at 0, clamped to length 1 and
     quantized to 1/256 (ADR-0009); its length sets the speed. The d-pad wins over the stick.
   - `getGamepads()` allocates inside the browser on each call; the adapter's own code allocates
     nothing per step.
8. **Touch and mouse use Pointer Events.**
   - Pointer positions are mapped to the logical screen with the canvas client rectangle and the
     layout. A pointer going down in the field rectangle is a `field` tap; anywhere else on the
     canvas, a `hud` tap; outside the canvas, nothing. Tap coordinates are floored.
   - **Touch.** The first finger down on the field drives the ship: the target is the finger's
     point raised by the GDD offset, in play-field pixels. Its moves are mapped wherever they
     fall, outside the field or the canvas included; the domain clamp holds the ship. Lifting it
     leaves `moveKind = 'none'`, so the ship stays. A finger that comes down while another drives
     the ship sets `Bomb` in `pressed`. A touch that starts outside the field is a tap only,
     never a move: the HUD region is where the touch buttons live. Those buttons (pause, bomb)
     arrive with the bricks that give them an effect; until then the second-finger tap is the
     only touch bomb. When the canvas meets the screen's bottom edge, the bottom of the field
     may be out of the thumb's reach: a tuning point for the offset in playtests.
   - **Mouse.** The target follows the cursor; the right button sets `Bomb`; the left button is a
     tap. The canvas suppresses the context menu and sets `touch-action: none`.
   - **Gestures** (ADR-0009 decision 2) are the events browsers accept as user activation:
     `keydown` except `Esc`, `pointerdown` from a mouse, `pointerup` from a finger or a pen.
9. **Pause in the first playable.** The adapter synthesizes `Pause` from the first playable
   build on. The scene machine ignores it in play until the `Paused` and count-in scenes land,
   no later than the enemies brick: with nothing to hit the ship, an unpaused hidden tab costs
   nothing.

## Alternatives considered

- **480 × 320 everywhere** — rejected: on a phone in portrait the play field stays small (about
  160 of 390 CSS px), against GDD §3.1 and §9.2.
- **Deferring the portrait screen again** — rejected: touch would ship barely usable on the
  devices it exists for.
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

## Consequences

- The renderer reallocates its off-screen surface when the layout changes; that happens on a
  resize, outside the game loop.
- The HUD has two arrangements; each HUD element is placed from `layout()`.
- ADR-0001's sentence giving `Canvas2DRenderer` sole access to `document` is read through
  ADR-0014 decision 7 and decision 4 above: no adapter references `window`, `document`,
  `navigator` or `requestAnimationFrame`; the composition root injects the canvas, event targets
  and accessors. Other browser APIs (`performance`, Web Audio, Web Storage) stay in their own
  adapters (ADR-0003).
- Tests implied: the layout choice across common viewports (desktop, windowed, phone portrait and
  landscape, tablet); pointer mapping to field and HUD in both layouts; the touch offset; device
  arbitration (stick and key together, mouse nudge during keyboard play); opposite keys;
  auto-repeat; gamepad dead zone, clamp, quantization and press edges between polls; automatic
  `Pause` on blur, hidden page and pad loss, with held state cleared.

## References

- GDD v0.5 §3.1, §4.1, §4.2, §9.2; ADR-0001, ADR-0009, ADR-0011, ADR-0012, ADR-0014.
- HTML Standard, activation-triggering input events:
  https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
- W3C Pointer Events: https://www.w3.org/TR/pointerevents/
- W3C Gamepad, standard gamepad layout: https://w3c.github.io/gamepad/#remapping
- MDN, CSS `touch-action`: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
