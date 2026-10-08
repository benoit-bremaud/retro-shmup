# ADR-0012: Shapes of the remappable bindings and of the key capture

**Status:** Accepted — 2026-10-08. Complements ADR-0009, which names `Bindings` and
`captureNext()` without fixing their shape; ADR-0009 stays accepted as it is.

## Context

- GDD v0.4 §4.2 fixes the rules: keyboard keys are bound by physical key (`KeyboardEvent.code`);
  each remappable intent (`move` ×4, `fire`, `bomb`, `pause`) has a primary and a secondary slot
  per device; a key already used elsewhere swaps with it, so **no intent is ever left unbound**;
  `confirm` and `back` are fixed; touch and mouse are not remappable; the capture is cancelled by
  `Esc` on keyboard and by a 5 s timeout on gamepad.
- ADR-0009 puts `setBindings(bindings)` and `captureNext()` on `InputPort` but leaves the types
  open. The pre-push review of the toolchain PR (2026-10-08) found that the first transcription
  invented two choices: gamepad buttons encoded as strings, and nullable primary slots.
- The Gamepad API reports buttons by **numeric index** in its standard mapping; the left stick is
  analog and is not a binding.

## Decision

```ts
export type RemappableIntent =
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'fire' | 'bomb' | 'pause';

/** A primary input that always exists and an optional secondary one. */
export interface BindingSlots<T> {
  readonly primary: T;
  readonly secondary: T | null;
}

export interface Bindings {
  readonly keyboard: Readonly<Record<RemappableIntent, BindingSlots<string>>>; // KeyboardEvent.code
  readonly gamepad: Readonly<Record<RemappableIntent, BindingSlots<number>>>;  // standard-mapping index
}

export type BindingCapture =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'key'; readonly code: string }
  | { readonly kind: 'button'; readonly index: number };
```

1. **Keyboard** slots hold `KeyboardEvent.code` strings; **gamepad** slots hold Gamepad API
   standard-mapping button indices.
2. **The primary slot is never empty**; the secondary slot may be. Remapping a slot to an input
   already used by another slot swaps the two, so the invariant holds after any remap.
3. **On gamepad, `move` ×4 bind to buttons** (the d-pad by default: indices 12–15); the left stick
   always moves the ship as an analog `direction` and is not remappable.
4. **Capture** is a discriminated union polled by the options scene; `cancelled` covers `Esc` on
   keyboard and the 5 s timeout on gamepad (GDD §4.2).

## Alternatives considered

- **Gamepad buttons as string ids** — rejected: the Gamepad API is index-based; strings would add a
  translation layer with no caller.
- **Nullable primary slots** — rejected: contradicts "no intent is ever left unbound".
- **Leaving the shapes out until the input brick** — rejected by the owner: the port would then
  diverge from the ADR-0009 text it transcribes.

## Consequences

- The options scene and the save document (ADR-0006) store bindings in these shapes.
- Tests implied: swap on conflict keeps every primary bound; `Esc` and the gamepad timeout cancel;
  defaults bind `move` to the arrows / `WASD` and to the d-pad.

## References

- GDD v0.4 §4.2; ADR-0006, ADR-0009.
- W3C Gamepad, standard gamepad layout: https://w3c.github.io/gamepad/#remapping
- MDN, `KeyboardEvent.code`: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
