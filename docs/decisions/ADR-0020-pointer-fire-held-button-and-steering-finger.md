# ADR-0020: Pointer fire — held button and steering finger, autofire as an option

**Status:** Accepted — 2026-10-12. **Partially supersedes ADR-0009** (decision 1, the sentence
"On touch and mouse `Fire` is always held (autofire)": touch and mouse now hold `Fire` only on a
player action, and the always-on `Fire` becomes an option), **ADR-0015** (decision 5, the
"always-on `Fire` of touch and mouse" in the buttons rule: the mask now applies to the autofire
option only; decision 8, mouse: the left button is no longer a tap only, it also holds `Fire`
after a press on the field) and **ADR-0018** (decision 2, "Only the left mouse button makes
taps": it still does, and a left press on the field also holds `Fire`). Every other part of those
ADRs stands, ADR-0018 decision 4 (a left press on the field takes the ship) included. Values are
GDD v0.9 values (§4.2, §9.3); interim deviations are recorded only in the scene machine
(`meta/05-state-scenes`, design revision v0.9).

## Context

- Since the devices brick (C2), touch and the mouse hold `Fire` in every sample
  (`PointerModule.sampleTouch` and `sampleMouse` set `held = Button.Fire` and `autofire = true`);
  `arbitrate` drops that `Fire` unless touch or the mouse owns the movement (ADR-0015
  decision 5).
- The owner's playtest after brick E (2026-10-12) found every device working, but the always-on
  fire gives the pointer player no control: no pause in firing to read the field, no way to hold
  fire, and an aimless stream when the ship is just being placed. Keyboard and gamepad hold fire
  with a button and were not questioned.
- Seven models were scored on the project's weighted criteria (control, discoverability,
  accessibility, touchpad comfort, implementation cost, consistency across devices): O5 "mouse
  hold + touch while steering + an autofire option" 46, O4 "mouse hold + touch while steering"
  44, O3 "a click toggles fire" 41, O1 "always-on autofire" (the v0.8 behaviour) 38, O7 "an
  option only" 38, O2 "mouse hold + touch always on" 35, O6 "fire only while moving" 30. The owner
  chose O5.

## Decision

1. **Mouse.** The mouse sample holds `Fire` while the **left button is down after a press on the
   field** — the same press that takes the ship (ADR-0018 decision 4). A left press outside the
   field (HUD, pause button, letterbox) stays a tap only and never fires, even while held. The
   pointer module keeps one boolean, set by a left press on the field and cleared when `buttons`
   loses the left bit (on up, move or cancel) and on lost focus; the right button stays the bomb
   on the field and never fires.
2. **Touch.** The touch sample holds `Fire` while a **finger steers** (`steering !== undefined`):
   the first finger on the field starts both the movement and the fire, lifting or cancelling it
   stops both. A second finger is still the bomb; a touch outside the field is still a tap only.
   A pen counts as touch (ADR-0018 decision 8).
3. **The held `Fire` of touch and mouse is an ordinary held button.** With the option off it sets
   `autofire = false` in the sample and combines with the other devices' buttons by bitwise OR,
   like the keyboard's `Space` or the gamepad's `A`. It lives in `held` only, never in `pressed`,
   as before. `arbitrate` does not change.
4. **The autofire option.** `DeviceSample.autofire` now means "this sample's `Fire` comes from
   the autofire option". When the option is on, touch and mouse set `held |= Button.Fire` and
   `autofire = true` in every sample, the v0.8 behaviour, and the arbitration keeps masking that
   `Fire` unless touch or the mouse owns the movement (ADR-0015 decision 5's rule, now scoped to
   the option). The option is off by default and is not read before the options screen.
5. **Keyboard and gamepad are unchanged**: they hold `Fire` with their fire binding, and the
   option does not affect them.
6. **Scenes, focus and the bomb finger.** A held pointer `Fire` is sampled in every scene; only
   `Playing` acts on it. A finger or left button still held when the count-in ends fires at
   once, like a held keyboard key. Lost focus clears the steering finger and the mouse buttons
   (ADR-0015 decision 5), so pointer fire stops. A second finger bombs without stopping or
   restarting the first finger's fire.
7. **Delivery.** Decisions 1 to 3 and 6 ship before or with the first PR of the level brick (F): the
   pointer module's two sample methods and the mouse fire latch, the tests listed below, the
   README device lines. Decision 4 ships with the options screen (screens brick G), which adds the
   switch to the save document and passes it to `DeviceInput`; until then the option does not
   exist and pointer fire is always the held fire of decisions 1 and 2.

## Alternatives considered

- **Keep the always-on autofire** (O1, 38) — rejected: little control, the playtest complaint.
- **Mouse hold, touch always on** (O2, 35) — rejected: on a touchpad holding a button while
  moving is awkward, and nothing helps players who cannot hold a button.
- **A click toggles fire on and off** (O3, 41) — rejected: the state is invisible without an
  indicator, and a stray click silently stops the fire.
- **Mouse hold and touch while steering, no option** (O4, 44) — rejected by two points: the
  touchpad and accessibility cases keep no way back to the v0.8 comfort.
- **Fire only while the ship moves** (O6, 30) — rejected: a still ship under a target cannot fire,
  the most common aiming position.
- **An option only, always-on by default** (O7, 38) — rejected: the default keeps the complaint.
- **Masking the held pointer `Fire` when the pointer does not own the movement** — rejected: a
  held button or a finger on the field is a deliberate action, like a held key; only the
  always-on option needs the mask.

## Consequences

- A pointer player can stop firing: lifting the finger or releasing the left button. A touch
  player who wants to fire without moving keeps the finger still on the field.
- `arbitrate` and the `IntentFrame` contract stay as they are; the change is local to
  `PointerModule.sampleTouch`, `sampleMouse` and the mouse button handling.
- Tests: touch holds `Fire` only while a finger steers and drops it on lift and on
  `pointercancel`; a second finger does not add `Fire`; the mouse holds `Fire` from a left press
  on the field until the left button is released (also through a `pointermove` that loses the
  left bit); a left press or hold on the HUD never fires; the right button never fires; lost focus
  drops the mouse fire; both samples report `autofire = false`. With the options brick: the
  option on restores the v0.8 samples and the existing arbitration mask tests.
- The smoke test is unchanged: it never relies on the pointer firing.
- README and CHANGELOG device lines lose "with autofire" with the code change, not with this
  design.

## References

- GDD v0.9 §4.2, §9.3, Decision record ("Pointer fire"); ADR-0009, ADR-0015, ADR-0018;
  `src/adapters/input/pointer.ts`, `src/adapters/input/arbitration.ts`;
  `docs/architecture/diagrams/meta/05-state-scenes.md` (design revision v0.9).
