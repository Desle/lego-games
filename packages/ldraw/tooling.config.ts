import { defineToolingConfig } from '@lego-games/tooling'

// Generic LDraw for every game port, browser code only: no game package, not the studio (the dev app that serves the files), and no
// app code by a relative path (layer-boundaries checks all three).
export default defineToolingConfig({
  forbiddenImports: ['@lego-games/lego-racers', '@lego-games/ldraw-studio'],
})
