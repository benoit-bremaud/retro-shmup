# ADR-0009: Input and audio contracts — intent frame, bindings, gestures, mix control

**Status:** Accepted — 2026-10-08. It replaces the `Intent` / `IntentFrame` /
`InputPort` sketches of ADR-0002 and ADR-0003 and the `AudioPort` sketch of ADR-0003; those ADRs
stay accepted for everything else (back-links added in a dedicated PR).

## Context

- ADR-0002 and ADR-0003 sketch input as `IntentFrame = ReadonlySet<Intent>`. The UML class study
  (2026-10-08) showed it cannot carry what GDD v0.2 requires:
  - on touch and mouse the ship **follows a point**; the gamepad stick is **analog** (§4.2);
  - menus need taps on on-screen buttons and a letter grid on touch (§4.2, §9.1);
  - remapping needs to wait for "the next key", show key labels of the active layout, and push
    bindings to the device layer (§4.2, UC6); the title screen shows the controls of the active
    device (§7.3); the gamepad-loss pause needs to know the active device (§9.1).
- A set built per tick allocates in the loop, which CLAUDE.md forbids, and a set of names cannot
  tell a **press** from a **hold**: holding `bomb` would bomb every tick, a tap shorter than one
  tick would be lost.
- `AudioPort { play; music }` cannot honour the pause mix (§9.1) nor the volume options (§9.3).
- Browsers grant audio unlock and fullscreen only **inside** a user-gesture event handler; a
  gamepad button is not a gesture (§4.2). The frame loop runs in `requestAnimationFrame`, outside
  any handler.
- Determinism (ADR-0002): the simulation must receive plain, copyable data each step.

## Decision

1. **One reusable, flat intent frame per simulation step.**

   ```ts
   export const Button = { Fire: 1, Bomb: 2, Pause: 4, Confirm: 8, Back: 16 } as const;
   export type Device = 'keyboard' | 'gamepad' | 'touch' | 'mouse';
   export type MoveKind = 'none' | 'direction' | 'target';
   export type TapRegion = 'none' | 'field' | 'hud';

   export interface IntentFrame {
     device: Device;     // last device used wins
     moveKind: MoveKind;
     moveX: number;      // direction: dx in [-1, 1] | target: play-field x in px
     moveY: number;      // direction: dy in [-1, 1] | target: play-field y in px
     held: number;       // Button bitmask, buttons down now
     pressed: number;    // Button bitmask, went down since the previous read
     tapRegion: TapRegion; // 'none' when no tap since the previous read
     tapX: number;         // in the region's coordinates (play field or HUD band), not screen px
     tapY: number;
     fullscreen: boolean;  // current fullscreen state, as reported by the browser
   }

   export interface InputPort {
     read(into: IntentFrame): void;          // fills the caller's frame in place
     setBindings(bindings: Bindings): void;  // physical-key slots of GDD §4.2
     captureNext(): BindingCapture;          // 'waiting' | a captured key | 'cancelled'
     label(code: string): string;            // key label in the active layout
     setFullscreenWanted(wanted: boolean): void; // applied at the next gesture
   }
   ```

   - `read` is called **once per simulation step**; the adapter latches every press until the
     next `read`, so short taps survive and one press is consumed once even when a frame runs
     several steps. The frame is a single preallocated object: no allocation per step. The
     simulation receives it as `Readonly<IntentFrame>`; tests and replays copy it.
   - Taps are converted by the adapter with the renderer's viewport transform (the same
     integer scale and offsets as `Canvas2DRenderer`), so the domain hit-tests in its own
     coordinates.
   - Keyboard and d-pad give a `direction` with unit components, normalized on diagonals; the
     stick gives its vector after a dead zone, quantized to 1/256 so replays stay exact; touch
     and mouse give a `target` in play-field pixels (the touch adapter applies the vertical
     offset). On touch and mouse `Fire` is always held (autofire).
   - The simulation moves the ship toward a `target` at most at the ship's maximum speed and
     snaps to it when closer than one step, so a pointer never gives more speed than a key.
   - Menus navigate with thresholded `direction` and act on `pressed`; on touch the domain draws
     its buttons and hit-tests `tapX` / `tapY` itself.
   - **Automatic pause** (§9.1): on focus loss, tab hidden or loss of the active gamepad the
     adapter sets `Pause` in `pressed`. The scene machine treats `Pause` as "enter pause" only;
     leaving the pause is a menu choice, so an automatic trigger can never resume the game.
2. **Gestures are handled inside the input adapter.** In its `pointerdown`, `keydown` and
   `touchend` handlers, the adapter unlocks the `AudioContext` on the first gesture and requests
   fullscreen when the flag set by `setFullscreenWanted` is on; `fullscreenchange` (for example
   `Esc`) is reported in the next frame's `fullscreen` field, and the options follow it. The
   composition root gives the input adapter the audio adapter's unlock hook (adapter-to-adapter
   wiring stays in `src/app`). When `document.fullscreenEnabled` is false (iPhone
   Safari) the option is hidden.
3. **The audio port controls the mix.**

   ```ts
   export interface AudioPort {
     play(sfx: SfxId): void;                        // game and UI sounds
     music(track: TrackId | null): void;
     setVolumes(music: number, sfx: number): void;  // 0..1 linear gains, from the options
     setPaused(paused: boolean): void;
   }
   ```

   `setPaused(true)` ducks the music to −12 dB over 150 ms and stops the game sounds playing; UI
   sounds (menu move, confirm) stay audible — a table keyed by `SfxId` tells UI sounds from game
   sounds. `setPaused(false)` restores the music over the 1 s
   count-in. The adapter suspends its `AudioContext` while the tab is hidden.
4. **The environment is injected, never queried by the domain**: a startup snapshot
   (`prefersReducedMotion`, the browser language, `touchCapable`, `fullscreenEnabled`) and a
   `today(): string` **function**, called when a high score is recorded — not at startup — so a
   page left open across midnight dates the score correctly.

## Alternatives considered

- **Keep `ReadonlySet<Intent>`, quantize touch and stick to eight directions** — rejected: breaks
  the "ship follows the finger" model, allocates per step, has no press / hold distinction.
- **Let the domain compare consecutive frames to detect presses** — rejected: a tap shorter than
  one step never appears in any frame.
- **HTML buttons over the canvas for touch menus** — rejected: two layout owners, untestable
  headless, and a second rendering technology.
- **Request fullscreen from the frame loop** — rejected: outside a gesture handler some browsers
  (Safari) refuse it.
- **A generic mixer `setBusGain(bus, gain, rampMs)`** — rejected for 1.0: two named operations
  cover every requirement (YAGNI).
- **A separate `PointerPort`** — rejected: two ports for one concept and a merge rule.

## Consequences

- Positive: four devices, menus and remapping share one plain-data frame; scripted inputs stay
  trivial in the headless simulation tests (ADR-0003); no allocation per step.
- Negative: the domain handles two movement kinds and draws its own touch buttons.
- Tests implied: adapter contract tests for press latching, dead zone, quantization, diagonal
  normalization and the touch offset; a domain test for pointer / key speed parity; a scene test
  proving that an automatic `Pause` never resumes.

## References

- GDD v0.3 §4.1, §4.2, §7.3, §9.1, §9.3; ADR-0002, ADR-0003; ADR-0010 (presentation outside the
  simulation outcome).
- HTML Standard, user activation:
  https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation
- MDN, `Element.requestFullscreen()`:
  https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
- MDN, `Gamepad.axes`: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/axes
- MDN, `AudioParam.setTargetAtTime()`:
  https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
