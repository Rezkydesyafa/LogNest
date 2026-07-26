import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/**/*.spec.ts', 'packages/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'tests/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['apps/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.module.ts',
        '**/dto/**',
        '**/main.ts',
        '**/*.d.ts',
        'apps/dashboard/src/components/ui/**',
      ],
    },
  },
});
