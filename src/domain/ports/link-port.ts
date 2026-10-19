/**
 * An opening armed for the next gesture (ADR-0027 decisions 2 and 5): the address; the field rows
 * (`top` to `bottom`, logical px) a tap or click must lift over, or `undefined` for any tap or
 * click (the gesture prompt); and which keys open it — `confirm` (`Enter`, the highlighted row is
 * the form's), `any` (the prompt) or `none`.
 */
export interface ArmedLink {
  readonly url: string;
  readonly band: { readonly top: number; readonly bottom: number } | undefined;
  readonly keys: 'confirm' | 'any' | 'none';
}

/** What the last gesture did with the armed link, read once by the scene machine. */
export type LinkOutcome = 'opened' | 'refused' | 'none';

/**
 * Opening an external page in a new tab (ADR-0027, meta/02-sequence-country-feedback). Browsers
 * open a tab only inside an input event's handler, before the scene machine sees that input: the
 * domain arms the opening while its row is highlighted, the adapter opens it inside the confirming
 * key's or the lifting pointer's handler, and the next step takes the outcome.
 */
export interface LinkPort {
  /** Arms `link` for the next confirming gesture, or disarms with `undefined`. */
  arm(link: ArmedLink | undefined): void;
  /** The outcome since the last call, then `none` until the next opening. */
  takeOutcome(): LinkOutcome;
}

/** No browser: nothing ever opens (tests, and a build without a form address). */
export const NO_LINK: LinkPort = {
  arm: () => undefined,
  takeOutcome: () => 'none',
};
