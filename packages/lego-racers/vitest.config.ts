import { defineConfig } from 'vitest/config'

// The golden-trace specs run the whole original race in the emulator; `pnpm run golden-trace` runs them.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', 'src/**/*.golden.spec.ts'],
  },
})
