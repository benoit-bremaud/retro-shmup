/**
 * Build-time switch of the online leaderboard (ADR-0031 decision 12), used by `vite.config.ts`.
 * Pure string functions, so the same rules are unit-tested here.
 */

/** What the build knows: the Pages variables and `package.json`'s version. */
export interface LeaderboardBuild {
  readonly url: string | undefined;
  readonly version: string;
  readonly releaseCommit: string | undefined;
  readonly pagesCommit: string | undefined;
}

const RELEASED = /^\d+\.\d+\.\d+$/;

/**
 * The leaderboard's origin, `''` (feature absent) unless the build is the release commit itself:
 * a strict `X.Y.Z` above `0.0.0` and `RELEASE_COMMIT` equal to `CF_PAGES_COMMIT_SHA`. An address
 * that is not a bare `https:` origin fails the build.
 */
export function leaderboardOrigin(build: LeaderboardBuild): string {
  const { url, version, releaseCommit, pagesCommit } = build;
  if (url === undefined || url === '') return '';
  if (!URL.canParse(url) || new URL(url).protocol !== 'https:' || new URL(url).origin !== url) {
    throw new Error('VITE_LEADERBOARD_URL must be a bare https:// origin');
  }
  if (!RELEASED.test(version) || version === '0.0.0') return '';
  if (releaseCommit === undefined || releaseCommit === '' || releaseCommit !== pagesCommit) {
    return '';
  }
  return url;
}

const CONNECT_SOURCE = "connect-src 'self'";

/** The `_headers` text with `origin` allowed in `connect-src`; unchanged without one. */
export function withConnectSource(headers: string, origin: string): string {
  if (origin === '') return headers;
  const parts = headers.split(`${CONNECT_SOURCE};`);
  if (parts.length !== 2) throw new Error(`_headers must hold ${CONNECT_SOURCE}; exactly once`);
  return parts.join(`${CONNECT_SOURCE} ${origin};`);
}
