import { createReadStream, statSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getFileUnder } from '../ldraw-file-paths/ldraw-file-paths.ts'
import { readLibraryParts } from '../ldraw-library-parts/ldraw-library-parts.ts'
import type { LDrawLibraryPart } from '../ldraw-library-parts/ldraw-library-parts.types.ts'
import {
  getIsLDrawModelPath,
  readLDrawModelFiles,
  readLDrawModelFolders,
} from '../ldraw-model-files/ldraw-model-files.ts'
import { DEFAULT_BACKUP_FOLDER, saveLDrawModel } from '../ldraw-model-save/ldraw-model-save.ts'
import { LDrawFileName, LDrawFileRoute } from './ldraw-file-routes.types.ts'
import type {
  LDrawFileMiddleware,
  LDrawFileRoutePaths,
  LDrawFileRoutesOptions,
  LDrawSaveRequest,
} from './ldraw-file-routes.types.ts'

const MAXIMUM_BODY_BYTES = 4_000_000

export const getLDrawFileRoutePaths = (routePrefix: string): LDrawFileRoutePaths =>
  Object.freeze({
    LIBRARY: `${routePrefix}/${LDrawFileRoute.LIBRARY}`,
    MODELS: `${routePrefix}/${LDrawFileRoute.MODELS}`,
    BUILDER: `${routePrefix}/${LDrawFileRoute.BUILDER}`,
  })

const sendJson = (response: ServerResponse, value: unknown) => {
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(value))
}

const sendError = (response: ServerResponse, status: number, message: string) => {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(message)
}

const sendTextFile = (response: ServerResponse, path: string | null) => {
  if (path === null) {
    sendError(response, 404, 'No such file')
    return
  }
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.setHeader('Content-Length', String(statSync(path).size))
  createReadStream(path).pipe(response)
}

const readBody = async (request: IncomingMessage): Promise<string | null> => {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    total += bytes.length
    if (total > MAXIMUM_BODY_BYTES) return null
    chunks.push(bytes)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const getSaveRequest = (body: string | null): LDrawSaveRequest | null => {
  try {
    const parsed: unknown = JSON.parse(body ?? '')
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      'text' in parsed &&
      typeof parsed.text === 'string'
      ? Object.freeze({ ...parsed, text: parsed.text })
      : null
  } catch {
    return null
  }
}

const getRequestPath = (request: string): string => request.split('?')[0] ?? ''

// The decoded file name after `<route>/`, null when the request is not on the route, undefined when it cannot be decoded.
const getRouteFile = (requestPath: string, route: string): string | null | undefined => {
  if (!requestPath.startsWith(`${route}/`)) return null
  try {
    return decodeURIComponent(requestPath.slice(route.length + 1))
  } catch {
    return undefined
  }
}

const getDefaultSavePath = (request: LDrawSaveRequest): string | null =>
  typeof request['path'] === 'string' ? request['path'] : null

// The dev server's LDraw files for any app, under one prefix: `<prefix>/ldraw/<file>` serves the parts library (a model may name a
// part in any case while the library's files are lower case, so the lower-case name is tried second); `<prefix>/ldraw-models/`
// serves the models folder (`index.json`, `files.json`, and the `.ldr` and `.mpd` files, read at every request so a new file shows
// after a reload); `<prefix>/ldraw-builder/` the library's part list (read once) and `save` (POST JSON with `text`), which writes a
// model after backing up the file it replaces. Paths that leave a folder are refused.
export const createLDrawFileRoutes = (options: LDrawFileRoutesOptions): LDrawFileMiddleware => {
  const paths = getLDrawFileRoutePaths(options.routePrefix)
  const getModelIndex = options.getModelIndex ?? ((folders) => folders)
  const getSavePath = options.getSavePath ?? getDefaultSavePath
  let parts: readonly LDrawLibraryPart[] | null = null

  const serveLibrary = (file: string, response: ServerResponse) =>
    sendTextFile(
      response,
      getFileUnder(options.libraryRoot, file) ??
        getFileUnder(options.libraryRoot, file.toLowerCase())
    )

  const serveModels = (file: string, response: ServerResponse) => {
    if (file === LDrawFileName.MODEL_INDEX) {
      sendJson(response, getModelIndex(readLDrawModelFolders(options.modelsRoot)))
      return
    }
    if (file === LDrawFileName.MODEL_FILES) {
      sendJson(response, readLDrawModelFiles(options.modelsRoot))
      return
    }
    sendTextFile(
      response,
      getIsLDrawModelPath(file) ? getFileUnder(options.modelsRoot, file) : null
    )
  }

  const save = async (request: IncomingMessage, response: ServerResponse) => {
    const saveRequest = getSaveRequest(await readBody(request))
    if (saveRequest === null) {
      sendError(response, 400, 'POST a JSON object with the model as `text`')
      return
    }
    const existingFiles = readLDrawModelFiles(options.modelsRoot).map((file) => file.path)
    const path = getSavePath(saveRequest, existingFiles)
    if (path === null) {
      sendError(response, 400, 'The request names no model file to save')
      return
    }
    const result = saveLDrawModel(
      options.modelsRoot,
      { path, text: saveRequest.text },
      options.backupFolder ?? DEFAULT_BACKUP_FOLDER,
      new Date()
    )
    if (typeof result === 'string') {
      sendError(response, 400, result)
      return
    }
    sendJson(response, { ...result, ...options.onModelSaved?.(result, saveRequest) })
  }

  const serveBuilder = (file: string, request: IncomingMessage, response: ServerResponse) => {
    const readJsonFile = options.builderJsonFiles?.[file]
    if (file === LDrawFileName.LIBRARY_PARTS) {
      parts ??= readLibraryParts(options.libraryRoot)
      sendJson(response, parts)
    } else if (readJsonFile !== undefined) {
      sendJson(response, readJsonFile())
    } else if (file === LDrawFileName.SAVE && request.method === 'POST') {
      void save(request, response)
    } else {
      sendError(response, 404, 'Unknown builder route')
    }
  }

  return (request, response, next) => {
    const requestPath = getRequestPath(request.url ?? '')
    const routes = [
      { route: paths.LIBRARY, serve: (file: string) => serveLibrary(file, response) },
      { route: paths.MODELS, serve: (file: string) => serveModels(file, response) },
      { route: paths.BUILDER, serve: (file: string) => serveBuilder(file, request, response) },
    ]
    for (const { route, serve } of routes) {
      const file = getRouteFile(requestPath, route)
      if (file === undefined) {
        sendError(response, 400, 'The path cannot be decoded')
        return
      }
      if (file !== null) {
        serve(file)
        return
      }
    }
    next()
  }
}
