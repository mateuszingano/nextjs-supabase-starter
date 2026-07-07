import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/**/*.d.ts', 'src/lib/supabase/database.types.ts'],
      // Anti-regression floor. Raise as coverage grows; never lower.
      thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
  },
})
