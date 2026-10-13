import { defineToolingConfig } from '@lego-games/tooling'

// The LDraw editor's own development page, for every game port: no game package, and no app code by a relative path (layer-boundaries
// checks both).
export default defineToolingConfig({
  forbiddenImports: ['@lego-games/lego-racers'],
})
