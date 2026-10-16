import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// The single browser smoke test (ADR-0003), against the built bundle, in the three engines
// (ADR-0026). Not in CI (ADR-0007, ADR-0013): run it with `make smoke` when render, input,
// bootstrap or save code changes. `pnpm test:smoke` builds first; the server below is `vite
// preview` itself, not a shell chain, so Playwright stops it and nothing stays on the port.
export default defineConfig({
  testDir: './tests/smoke',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${String(PORT)}` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `./node_modules/.bin/vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
