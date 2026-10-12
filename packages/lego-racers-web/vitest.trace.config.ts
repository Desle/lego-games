import { defineConfig } from 'vitest/config'

// The trace specs run the original game in the emulator and compare what it shows and plays with the viewer's; the
// root scripts `render-trace` and `audio-trace` run them.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.trace.spec.ts'],
    testTimeout: 1_800_000,
  },
})
