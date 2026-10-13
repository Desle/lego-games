import { createLDrawFileRoutes } from '@lego-games/ldraw-studio/files'
import type { LDrawFileMiddleware } from '@lego-games/ldraw-studio/files'
import type { Plugin } from 'vite'
import {
  getBuilderSavePath,
  markBuilderItemDone,
  readBuilderProgress,
} from '../ldraw-builder/builder-files.ts'
import {
  BUILDER_BACKUP_FOLDER,
  BUILDER_PROGRESS_FILE,
} from '../ldraw-builder/ldraw-builder-route.ts'
import { createLDrawModelIndex } from './ldraw-model-index.ts'

export const DEVELOPMENT_ROUTE_PREFIX = '/__development'

// The shared LDraw file routes with what LEGO Racers adds: the index of cars, chassis and drivers, saves by builder item (the
// file the game reads) that mark the item done, and the builder's progress.
export const createRacersLDrawFileRoutes = (
  libraryRoot: string,
  modelsRoot: string
): LDrawFileMiddleware =>
  createLDrawFileRoutes({
    libraryRoot,
    modelsRoot,
    routePrefix: DEVELOPMENT_ROUTE_PREFIX,
    backupFolder: BUILDER_BACKUP_FOLDER,
    getModelIndex: createLDrawModelIndex,
    getSavePath: getBuilderSavePath,
    onModelSaved: (_saved, request) => markBuilderItemDone(modelsRoot, request),
    builderJsonFiles: { [BUILDER_PROGRESS_FILE]: () => readBuilderProgress(modelsRoot) },
  })

// The LDraw parts library, the player's models folder and the builder's routes, on the dev server only (`apply: 'serve'`).
export const developmentLDrawFilesPlugin = (libraryRoot: string, modelsRoot: string): Plugin => ({
  name: 'lego-racers-development-ldraw-files',
  apply: 'serve',
  configureServer: (server) =>
    void server.middlewares.use(createRacersLDrawFileRoutes(libraryRoot, modelsRoot)),
})
