import { homedir } from 'node:os'
import { join } from 'node:path'
import { createLDrawFileRoutes } from './src/modules/files/index.ts'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { STUDIO_ROUTE_PREFIX } from './src/modules/studio/services/studio-routes/studio-routes.constants.ts'

const STUDIO_PORT = 5200

// The same variables as the LEGO Racers dev server, so both pages show the same library and models folder.
const LDRAW_LIBRARY_ROOT = process.env['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')
const LDRAW_MODELS_ROOT = process.env['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models')

const studioFilesPlugin = (): Plugin => ({
  name: 'ldraw-studio-files',
  apply: 'serve',
  configureServer: (server) =>
    void server.middlewares.use(
      createLDrawFileRoutes({
        libraryRoot: LDRAW_LIBRARY_ROOT,
        modelsRoot: LDRAW_MODELS_ROOT,
        routePrefix: STUDIO_ROUTE_PREFIX,
      })
    ),
})

export default defineConfig({
  plugins: [studioFilesPlugin()],
  server: { port: STUDIO_PORT, strictPort: true },
  // Found late through the library's modules, Vite re-bundles these and the open page's imports fail (a blank page).
  optimizeDeps: {
    include: [
      'three/examples/jsm/controls/OrbitControls.js',
      'three/examples/jsm/loaders/LDrawLoader.js',
      'three/examples/jsm/materials/LDrawConditionalLineMaterial.js',
    ],
  },
})
