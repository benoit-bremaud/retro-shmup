import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The composition root is covered by the browser smoke test, not by unit tests (ADR-0003 §7).
      exclude: ['src/**/*.d.ts', 'src/app/main.ts'],
      reporter: ['text', 'lcov'],
      // Every function is tested. The floors are a ratchet at the measured values: what is left
      // are noUncheckedIndexedAccess guards on in-range indices, kept free of ignore comments by
      // owner decision (2026-10-16). Raise them, never lower them.
      thresholds: {
        statements: 99.2,
        branches: 95.6,
        functions: 100,
        lines: 99.9,
      },
    },
  },
});
