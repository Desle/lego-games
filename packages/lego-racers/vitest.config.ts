import { getNodeTestOptions } from '@lego-games/tooling/vitest'
import { defineConfig } from 'vitest/config'

// The golden-trace specs run the whole original race in the emulator; `pnpm run golden-trace` runs them.
export default defineConfig({
  test: {
    ...getNodeTestOptions(import.meta.dirname + '/../..'),
    exclude: ['**/node_modules/**', 'src/**/*.golden.spec.ts'],
  },
})
