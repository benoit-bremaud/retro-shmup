/**
 * Input tuning (GDD §4.2, ADR-0018 decision 9), next to `DEFAULT_BINDINGS`: the adapters read it,
 * the save document will never store it.
 */
export const InputTuning = {
  /** The ship follows the steering finger this many play-field pixels above it (GDD §4.2). */
  touchOffsetY: 32,
  /** Stick length below which the stick reads 0: a radial dead zone (GDD §4.2). */
  stickDeadZone: 0.2,
  /** Stick components are whole multiples of 1/stickSteps, so replays stay exact (ADR-0009). */
  stickSteps: 256,
  /** A gamepad capture cancels itself after this long without a button (GDD §4.2). */
  captureTimeoutSeconds: 5,
} as const;
