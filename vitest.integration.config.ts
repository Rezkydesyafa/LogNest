import { defineConfig } from 'vitest/config';

/**
 * Integration suite. Kept separate from the unit suite because it needs Docker, takes
 * minutes rather than seconds, and must not run in parallel: every file shares one set of
 * containers and one database.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.spec.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
    teardownTimeout: 120_000,
  },
});
