/** A git commit as the build may pass it: 7 to 40 lowercase hex characters, nothing else. */
const COMMIT = /^[0-9a-f]{7,40}$/;

/**
 * The version label of GDD v0.20 §9.9 (ADR-0025 decision 6): `v<version>+<short commit>`, or
 * `v<version>` when the commit is missing or not a git hash. The commit comes from the build
 * environment, so anything else is dropped rather than shown.
 */
export function versionLabel(version: string, commit: string): string {
  return COMMIT.test(commit) ? `v${version}+${commit.slice(0, 7)}` : `v${version}`;
}
