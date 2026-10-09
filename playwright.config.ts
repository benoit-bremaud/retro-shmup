import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// The single browser smoke test (ADR-0003), against the built bundle, Chromium only. Not in CI
// (ADR-0007, ADR-0013): run it with `make smoke` when render, input or bootstrap code changes.
export default defineConfig({
  testDir: './tests/smoke',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${String(PORT)}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
