import type { MessageKey } from '../i18n/messages';
import type { FailureCode, RunStatus } from '../ports/leaderboard-port';

/** The line a failed send or erasure shows (GDD v0.35–v0.36 §9.1): one per failure code. */
const FAILURE_LINES: Readonly<Record<FailureCode, MessageKey>> = {
  offline: 'offline',
  'duplicate-run': 'alreadySent',
  'unknown-version': 'versionRefused',
  'name-refused': 'nameRefused',
  'too-long': 'runTooLong',
  'rate-limited': 'tooManyTries',
  // Any other answer, a timeout, an unreadable accepted answer, a browser that cannot pack the run.
  timeout: 'serverError',
  'accepted-unreadable': 'serverError',
  unsupported: 'serverError',
  'bad-request': 'serverError',
  'server-error': 'serverError',
};

/** The line of a sent run's status (GDD v0.35 §9.1). */
const STATUS_LINES: Readonly<Record<RunStatus, MessageKey>> = {
  pending: 'pending',
  verified: 'verified',
  rejected: 'rejected',
  unverifiable: 'unverifiable',
  expired: 'expired',
};

/** The catalogue line of a failure code. */
export function failureLine(error: FailureCode): MessageKey {
  return FAILURE_LINES[error];
}

/** The catalogue line of a verifier status. */
export function statusLine(status: RunStatus): MessageKey {
  return STATUS_LINES[status];
}
