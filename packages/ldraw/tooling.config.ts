import { defineToolingConfig } from '@lego-games/tooling'

// Generic LDraw for every game port: no game package, and no app code by a relative path (layer-boundaries checks both).
export default defineToolingConfig({
  forbiddenImports: ['@lego-games/lego-racers'],
})
