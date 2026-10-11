/**
 * Input tuning (GDD §4.2, ADR-0018 decision 9), next to `DEFAULT_BINDINGS`: the adapters read it,
 * the save document will never store it. The gamepad stick values join with the gamepad.
 */
export const InputTuning = {
  /** The ship follows the steering finger this many play-field pixels above it (GDD §4.2). */
  touchOffsetY: 32,
} as const;
