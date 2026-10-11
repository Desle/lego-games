import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/**/*.trace.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
