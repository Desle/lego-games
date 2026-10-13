import type { IncomingMessage, ServerResponse } from 'node:http'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { LDrawModelFolders } from '../ldraw-model-files/ldraw-model-files.types.ts'
import type { LDrawModelRemoveResult } from '../ldraw-model-remove/ldraw-model-remove.types.ts'
import type { LDrawModelSaveResult } from '../ldraw-model-save/ldraw-model-save.types.ts'

// The routes under the prefix: the parts library, the models folder, and the builder's part list, save and remove.
export const LDrawFileRoute = createEnum({
  LIBRARY: 'ldraw',
  MODELS: 'ldraw-models',
  BUILDER: 'ldraw-builder',
})
export type LDrawFileRoute = EnumValues<typeof LDrawFileRoute>

export const LDrawFileName = createEnum({
  MODEL_INDEX: 'index.json',
  MODEL_FILES: 'files.json',
  LIBRARY_PARTS: 'parts.json',
  SAVE: 'save',
  REMOVE: 'remove',
})
export type LDrawFileName = EnumValues<typeof LDrawFileName>

// The JSON body of a save or a removal: what the app's `getSavePath` or `getRemovePath` reads (by default `path`).
export type LDrawFileRequest = Readonly<Record<string, unknown>>

// The JSON body of a save: the model as `text`, and what names its file.
export type LDrawSaveRequest = LDrawFileRequest & { readonly text: string }

export type LDrawFileRoutesOptions = {
  readonly libraryRoot: string
  readonly modelsRoot: string
  // Without a trailing slash, e.g. `/__development`.
  readonly routePrefix: string
  // In the models folder; `drafts/backups` when left out.
  readonly backupFolder?: string
  // The models route's `index.json`; the model files by folder when left out.
  readonly getModelIndex?: (folders: LDrawModelFolders) => unknown
  // The models folder's file a save writes, given the files already there; null refuses the save. By default the request's `path`.
  readonly getSavePath?: (
    request: LDrawSaveRequest,
    existingFiles: readonly string[]
  ) => string | null
  // Called after a save; what it returns is added to the save's answer.
  readonly onModelSaved?: (
    saved: LDrawModelSaveResult,
    request: LDrawSaveRequest
  ) => Readonly<Record<string, unknown>>
  // The models folder's file a removal moves into the backup folder, given the files already there; null refuses it. By default the
  // request's `path`.
  readonly getRemovePath?: (
    request: LDrawFileRequest,
    existingFiles: readonly string[]
  ) => string | null
  // Called after a removal; what it returns is added to the removal's answer.
  readonly onModelRemoved?: (
    removed: LDrawModelRemoveResult,
    request: LDrawFileRequest
  ) => Readonly<Record<string, unknown>>
  // More JSON documents the app serves on the builder route, by file name, read at every request.
  readonly builderJsonFiles?: Readonly<Record<string, () => unknown>>
}

// A connect-style middleware, as Vite's dev server and connect take it.
export type LDrawFileMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void

export type LDrawFileRoutePaths = Readonly<Record<keyof typeof LDrawFileRoute, string>>
