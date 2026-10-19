import { feedbackUrl } from '../feedback/feedback-link';
import type { FeedbackContext } from '../feedback/feedback-link';
import { toSteps } from '../game/tuning';
import { NO_LINK } from '../ports/link-port';
import type { ArmedLink, LinkOutcome, LinkPort } from '../ports/link-port';

/** How long *OPEN BLOCKED* shows after a refused tab (GDD v0.26 §9.1). */
const BLOCKED_STEPS = toSteps(2);

/** Where an opening is armed, without its address: a menu row's band and keys, or the prompt's. */
export type ArmedAt = Omit<ArmedLink, 'url'>;

/** The gesture prompt's arming: any tap, click or key. */
export const ANY_GESTURE: ArmedAt = { band: undefined, keys: 'any' };

/** The build's feedback settings (ADR-0027 decision 1): an empty form turns the feature off. */
export interface FeedbackSettings {
  /** The checked form address (`feedbackForm`), or `''`. */
  readonly form: string;
  /** `MAJOR.MINOR.PATCH` (GDD v0.20 §9.9). */
  readonly version: string;
  readonly link: LinkPort;
}

export const NO_FEEDBACK: FeedbackSettings = { form: '', version: '', link: NO_LINK };

/**
 * The feedback form's opening (GDD v0.26 §9.1, ADR-0027 decisions 2 to 5): arms the link while a
 * feedback row is highlighted, so the adapter can open it inside the gesture's handler, and keeps
 * *OPEN BLOCKED* on screen for 2 s after a refusal. The address is built on an arming only.
 */
export class FeedbackFlow {
  private readonly settings: FeedbackSettings;
  private armed: ArmedAt | undefined;
  private url = '';
  private blockedLeft = 0;

  constructor(settings: FeedbackSettings) {
    this.settings = settings;
  }

  /** False in a build without a form address: no *Feedback* row, no offer. */
  get enabled(): boolean {
    return this.settings.form !== '';
  }

  /** *OPEN BLOCKED* shows. */
  get blocked(): boolean {
    return this.blockedLeft > 0;
  }

  /**
   * One step of a screen offering the form: arms at `at`, one of the screen's constant armings
   * (compared by identity, so a step allocates nothing; the context is read on a first arming), or disarms with
   * `undefined`; the link hears a change only. Returns the outcome of the gestures since the last
   * step, so an opening never outlives the step that should act on it.
   */
  step(at: ArmedAt | undefined, context: () => FeedbackContext): LinkOutcome {
    if (this.blockedLeft > 0) this.blockedLeft -= 1;
    if (at === undefined) this.disarm();
    else if (at !== this.armed) {
      if (this.armed === undefined) this.url = feedbackUrl(this.settings.form, context());
      this.armed = at;
      this.settings.link.arm({ url: this.url, band: at.band, keys: at.keys });
    }
    return this.settings.link.takeOutcome();
  }

  /** Leaving the screens that offer the form: nothing stays armed, no outcome is kept. */
  disarm(): void {
    if (this.armed === undefined) return;
    this.armed = undefined;
    this.settings.link.arm(undefined);
    this.settings.link.takeOutcome();
  }

  /** The browser refused the tab: *OPEN BLOCKED* for 2 s. */
  block(): void {
    this.blockedLeft = BLOCKED_STEPS;
  }
}
