import { existsSync, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import type { Plugin } from 'vite'
import {
  DEVELOPMENT_LDRAW_MODELS_ROUTE,
  LDRAW_MODEL_EXTENSIONS,
  LDRAW_MODEL_FILES_FILE,
  LDRAW_MODEL_INDEX_FILE,
} from '../ldraw-models/ldraw-models-route.ts'
import { serveTextFile } from '../development-ldraw-server/development-ldraw-server.ts'
import { readLDrawModelFiles } from './read-ldraw-model-files.ts'
import { readLDrawModelIndex } from './read-ldraw-model-index.ts'

const getModelPath = (root: string, relativePath: string): string | null => {
  const path = normalize(join(root, relativePath))
  const isModel = LDRAW_MODEL_EXTENSIONS.some((extension) => path.toLowerCase().endsWith(extension))
  return isModel && path.startsWith(root + sep) && existsSync(path) && statSync(path).isFile()
    ? path
    : null
}

// Serves the player's hand-built racer models to the dev server only: `index.json` (what is in the folder, read at every request so a
// new file shows after a reload) and the `.ldr` and `.mpd` files themselves.
export const developmentLDrawModelsPlugin = (root: string): Plugin => ({
  name: 'lego-racers-development-ldraw-models',
  apply: 'serve',
  configureServer: (server) =>
    void server.middlewares.use(DEVELOPMENT_LDRAW_MODELS_ROUTE, (request, response) => {
      const requested = decodeURIComponent(
        (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
      )
      if (requested === LDRAW_MODEL_INDEX_FILE) {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(readLDrawModelIndex(root)))
        return
      }
      if (requested === LDRAW_MODEL_FILES_FILE) {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        response.end(JSON.stringify(readLDrawModelFiles(root)))
        return
      }
      const path = getModelPath(root, requested)
      serveTextFile(response, path)
    }),
})
