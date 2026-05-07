import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in Node environment — no DOM, no browser.
    environment: 'node',

    // Each test file owns its own admin SDK / db connection. Sequential
    // execution avoids port contention against a single emulator.
    fileParallelism: false,

    // Default test timeout. Emulator startup can take a few seconds
    // on first connection so we leave headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,

    include: ['test/**/*.test.ts'],

    // Hide noisy emulator logs from the test runner output unless
    // a test fails. Comment out to debug.
    silent: false,
  },
});
