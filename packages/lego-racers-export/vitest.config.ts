import { getNodeTestOptions } from '@lego-games/tooling/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { ...getNodeTestOptions(import.meta.dirname + '/../..'), exclude: ['**/node_modules/**'] },
})
