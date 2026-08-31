import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/__fixtures__/**'],
      thresholds: {
        // The financial core is the part that must not rot — §37.
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
})
