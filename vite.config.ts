import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Relative by default: the same build runs at the Pages root and inside itch.io's player (ADR-0004).
    base: env.VITE_BASE_URL ?? './',
    // The version label of GDD v0.20 §9.9, fixed at build time (ADR-0025 decision 6).
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion()),
      __APP_COMMIT__: JSON.stringify(buildCommit()),
      __FEEDBACK_FORM__: JSON.stringify(feedbackFormAddress(env.VITE_FEEDBACK_FORM_URL)),
    },
    // No asset inlined as a data: URI, so the CSP needs no data: source (ADR-0008 decision 4).
    build: { target: 'es2022', sourcemap: true, assetsInlineLimit: 0 },
  };
});
