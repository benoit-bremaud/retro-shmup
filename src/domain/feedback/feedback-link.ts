import type { Device } from '../ports/input-port';
import type { Language } from '../i18n/messages';

/** The number of question sets the form holds (GDD v0.26 §9.1), a constant of the game. */
export const FEEDBACK_SETS = 3;

/** The only form host a build may hold (ADR-0027 decision 1), checked at build and at start. */
export const FEEDBACK_HOST = 'https://tally.so/';

/** The run context sent to the form as its hidden fields (ADR-0027 decision 3); never personal. */
export interface FeedbackContext {
  /** The saved feedback count: picks the question set. */
  readonly count: number;
  /** `MAJOR.MINOR.PATCH`, without the commit (GDD v0.20 §9.9). */
  readonly version: string;
  readonly score: number;
  readonly level: number;
  /** The saved country choice: a code, `none`, or `undefined` while never asked (sent empty). */
  readonly country: string | undefined;
  readonly device: Device;
  readonly lang: Language;
}

/** The form address a build may use: `address` when it is on `FEEDBACK_HOST`, else `''` (off). */
export function feedbackForm(address: string): string {
  return address.startsWith(FEEDBACK_HOST) && !/[?#\s]/.test(address) ? address : '';
}

/** A whole number from 0, else 0: the values sent are always numbers. */
function whole(value: number): string {
  return String(Number.isSafeInteger(value) && value >= 0 ? value : 0);
}

/**
 * The form's address with the context as query parameters (ADR-0027 decisions 3 and 4): `set` is
 * the count modulo `FEEDBACK_SETS`, plus 1; every value is a number or an allowlisted string,
 * encoded with `encodeURIComponent`. Called on an arming, never per frame.
 */
export function feedbackUrl(form: string, context: Readonly<FeedbackContext>): string {
  const set = (Number(whole(context.count)) % FEEDBACK_SETS) + 1;
  const fields: readonly (readonly [string, string])[] = [
    ['set', String(set)],
    ['version', context.version],
    ['score', whole(context.score)],
    ['level', whole(context.level)],
    ['country', context.country ?? ''],
    ['device', context.device],
    ['lang', context.lang],
  ];
  let query = '';
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (field === undefined) continue;
    query += `${i === 0 ? '?' : '&'}${field[0]}=${encodeURIComponent(field[1])}`;
  }
  return form + query;
}
