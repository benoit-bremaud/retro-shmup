import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { leaderboardOrigin, withConnectSource } from './src/app/leaderboard-build.ts';

/** `package.json`'s version, the one ADR-0025 bumps; the build fails without one. */
function packageVersion(): string {
  const manifest: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
  const version: unknown =
    typeof manifest === 'object' && manifest !== null ? Reflect.get(manifest, 'version') : '';
  if (typeof version !== 'string' || version === '') throw new Error('package.json has no version');
  return version;
}

/** Cloudflare Pages' commit, else git's, else `''` (no shell: argument list only). */
function buildCommit(): string {
  const pages = process.env.CF_PAGES_COMMIT_SHA;
  if (pages !== undefined && pages !== '') return pages;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** The feedback form's address, `''` when unset; any other host fails the build (ADR-0027). */
function feedbackFormAddress(value: string | undefined): string {
  if (value === undefined || value === '') return '';
  if (!value.startsWith('https://tally.so/') || /[?#\s]/.test(value)) {
    throw new Error('VITE_FEEDBACK_FORM_URL must be a https://tally.so/ address without query');
  }
  return value;
}

/** Allows the leaderboard's origin in the built `_headers` CSP (ADR-0031 decision 12). */
function leaderboardCsp(origin: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'leaderboard-csp',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (origin === '') return;
      const file = join(outDir, '_headers');
      writeFileSync(file, withConnectSource(readFileSync(file, 'utf8'), origin));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const leaderboard = leaderboardOrigin({
    url: env.VITE_LEADERBOARD_URL,
    version: packageVersion(),
    releaseCommit: process.env.RELEASE_COMMIT,
    pagesCommit: process.env.CF_PAGES_COMMIT_SHA,
  });
  return {
    plugins: [leaderboardCsp(leaderboard)],
    // Relative by default: the same build runs at the Pages root and inside itch.io's player (ADR-0004).
    base: env.VITE_BASE_URL ?? './',
    // The version label of GDD v0.20 §9.9, fixed at build time (ADR-0025 decision 6).
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion()),
      __APP_COMMIT__: JSON.stringify(buildCommit()),
      __FEEDBACK_FORM__: JSON.stringify(feedbackFormAddress(env.VITE_FEEDBACK_FORM_URL)),
      __LEADERBOARD_URL__: JSON.stringify(leaderboard),
    },
    // No asset inlined as a data: URI, so the CSP needs no data: source (ADR-0008 decision 4).
    build: { target: 'es2022', sourcemap: true, assetsInlineLimit: 0 },
  };
});
