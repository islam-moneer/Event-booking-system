import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Test files share one Postgres database, and the beforeEach hook
    // truncates every table. Running files in parallel would let one file's
    // truncate delete another file's fixtures mid-test.
    fileParallelism: false,
    // Concurrency tests deliberately race real transactions; the default 5s
    // is tight once lock waits are involved.
    testTimeout: 15_000,
  },
});
