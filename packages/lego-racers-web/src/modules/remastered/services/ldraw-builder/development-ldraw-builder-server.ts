import { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { readBuilderProgress, readLibraryParts, saveBuilderModel } from './builder-files.ts'
import {
  BUILDER_PARTS_FILE,
  BUILDER_PROGRESS_FILE,
  BUILDER_SAVE_PATH,
  DEVELOPMENT_LDRAW_BUILDER_ROUTE,
} from './ldraw-builder-route.ts'
import type { BuilderSaveRequest, LibraryPart } from './ldraw-builder.types.ts'

const MAXIMUM_BODY_BYTES = 4_000_000

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

const getSaveRequest = (body: string | null): BuilderSaveRequest | null => {
  try {
    const parsed: unknown = JSON.parse(body ?? '')
    return typeof parsed === 'object' &&
      parsed !== null &&
      'itemId' in parsed &&
      'text' in parsed &&
      typeof parsed.itemId === 'string' &&
      typeof parsed.text === 'string'
      ? { itemId: parsed.itemId, text: parsed.text }
      : null
  } catch {
    return null
  }
}

const sendJson = (response: ServerResponse, value: unknown) => {
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(value))
}

const sendError = (response: ServerResponse, status: number, message: string) => {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(message)
}

// The car builder's routes, on the dev server only (`apply: 'serve'`): the library's part list (read once), the progress, and `save`
// (POST `{ itemId, text }`), which writes the model into the models folder after backing up the file it replaces.
export const developmentLDrawBuilderPlugin = (modelsRoot: string, libraryRoot: string): Plugin => {
  let parts: readonly LibraryPart[] | null = null
  return {
    name: 'lego-racers-development-ldraw-builder',
    apply: 'serve',
    configureServer: (server) =>
      void server.middlewares.use(DEVELOPMENT_LDRAW_BUILDER_ROUTE, (request, response) => {
        const requested = (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
        if (requested === BUILDER_PARTS_FILE) {
          parts ??= readLibraryParts(libraryRoot)
          sendJson(response, parts)
          return
        }
        if (requested === BUILDER_PROGRESS_FILE) {
          sendJson(response, readBuilderProgress(modelsRoot))
          return
        }
        if (requested !== BUILDER_SAVE_PATH || request.method !== 'POST') {
          sendError(response, 404, 'Unknown builder route')
          return
        }
        void readBody(request).then((body) => {
          const saveRequest = getSaveRequest(body)
          if (saveRequest === null) {
            sendError(response, 400, 'POST { itemId, text } as JSON')
            return
          }
          const result = saveBuilderModel(modelsRoot, saveRequest, new Date())
          if (typeof result === 'string') sendError(response, 400, result)
          else sendJson(response, result)
        })
      }),
  }
}
