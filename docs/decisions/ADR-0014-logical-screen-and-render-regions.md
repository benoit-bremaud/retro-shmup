# ADR-0014: Logical screen 480 × 320, render regions and step units

**Status:** Accepted — 2026-10-08. **Partially supersedes ADR-0001**: the size of its off-screen
canvas (240 × 320 → 480 × 320), its scale formula, and where screen shake is applied. Refines
ADR-0010 decision 6 (the HUD region) and fixes the step unit, which ADR-0002 and the frame
sequence of the UML study stated differently. Updates the off-screen size quoted in GDD §3.1; the
play field itself stays 240 × 320.

## Context

- The play field is 240 × 320 (GDD §3.1); the HUD lives in side bands outside it (GDD §9.2);
  `RenderPort.setRegion('field' | 'hud')` selects the coordinate space (ADR-0010) but the size of
  the bands and the scaling rules were open.
- Landscape screens are height-limited: the integer scale factor is set by the 320 px height on
  every common display, as long as the logical width does not exceed the screen's aspect ratio.
  Computed for the owner's targets **in fullscreen** (×3 needs 960 CSS px of inner height; GDD §9.3,
  ADR-0009): a 3:2 logical screen keeps ×3 on 1920 × 1080 (16:9) **and** on 1680 × 1050 (16:10);
  a 16:9 logical screen drops to ×2 on 16:10 laptops. In a window, ×2 is typical and the widths
  tie.
- Pixel-perfect rendering needs integer positions in logical pixels; interpolated positions
  (ADR-0002) are fractional.
- ADR-0002 calls `step(1 / 60, …)` — seconds — while the frame sequence of the UML study counts
  `STEP = 1000 / 60` milliseconds.

## Decision

1. **Logical screen: 480 × 320.** The play field occupies x ∈ [120, 360); two HUD bands of
   120 × 320 sit left and right. The owner chose this geometry on 2026-10-08.
2. **Regions.** `setRegion('field')`: origin at the field's top-left (logical x 120), drawing
   clipped to 240 × 320. `setRegion('hud')`: origin at the logical screen's top-left, drawing in
   the whole 480 × 320 (x 0–479); the domain places the HUD in the bands through this region.
   **Screen shake** (`setCameraOffset`) moves field-region draws only, applied at draw time: the
   HUD never shakes (ADR-0001 applied it at `present()`).
3. **Rendering.** The adapter draws into an off-screen canvas of exactly 480 × 320 at integer
   positions (rounded), then `present()` copies it to the visible canvas with image smoothing off
   (ADR-0001).
4. **Scale.** `scale = max(1, floor(min(viewportW × dpr / 480, viewportH × dpr / 320)))`, computed
   in device pixels (`devicePixelRatio`) so the pixels stay sharp on high-density screens; the
   visible canvas is centred, the rest of the window is black. A pure function computes it and
   is unit-tested.
5. **Step units.** The domain receives `dt` in **seconds** (`1 / 60`), as ADR-0002 states; the
   frame loop keeps its accumulator, clamp (250 ms) and wall time in **milliseconds**. The frame
   sequence's `step(STEP, frame)` reads `step(1 / 60, frame)`.
6. **Portrait phones** (GDD §9.2: HUD strip on top) are decided with touch input (vertical-slice
   input PR); until then the 480 × 320 layout scales down to ×1 at minimum.
7. **Browser APIs in the composition root.** Only `src/app/main.ts` may touch `window`,
   `document`, `requestAnimationFrame` and `Math.random` (as the unseeded presentation
   generator); `src/domain` never does (ADR-0003). The component diagram already places the
   bootstrap and the frame driver in `src/app`.

## Alternatives considered

- **568 × 320 (16:9)** — rejected: fills 16:9 screens but drops to ×2 on 16:10 laptops; bands half
  empty.
- **426 × 320 (4:3)** — rejected: a cramped HUD for an 8-digit score, multiplier, lives, bombs and
  weapon.
- **240 × 320 with the HUD over the field** — rejected: contradicts GDD §9.2.
- **Drawing directly on the visible canvas with a scale transform** — rejected: ADR-0001 mandates
  an off-screen surface; one blit per frame keeps drawing independent of the window size, and the
  rounding to logical pixels stays in one place.

## Consequences

- The window's spare width (for example 240 px each side on 1080p in fullscreen) is black and may
  later carry a decorative arcade frame without touching the game.
- Negative: the off-screen surface and the per-frame copy are twice as large as with ADR-0001's
  240 × 320; on portrait phones the HUD bands take width until decision 6 lands.
- Taps reach the domain in region coordinates (ADR-0009): the input adapter reuses the same
  viewport computation.
- Tests implied: the scale function across common viewports and pixel ratios; the renderer
  against a recording canvas double (region origin, clipping, rounding, present scaling).

## References

- GDD v0.4 §3.1, §9.2; ADR-0001, ADR-0002, ADR-0009, ADR-0010.
- MDN, `Window.devicePixelRatio`:
  https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN, `CanvasRenderingContext2D.imageSmoothingEnabled`:
  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled
