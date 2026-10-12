import { buildParseResult, getTransferables } from './ldraw-parse-work.ts'
import type { ParseWorkerScope } from './ldraw-parse.types.ts'

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const scope = globalThis as unknown as ParseWorkerScope

// Parses LDraw models for the page: the library's parser, the merging and the baking run here, off the page's thread, so a car that
// loads does not stall the race that is drawing.
scope.addEventListener('message', (event) => {
  const { id, request } = event.data
  buildParseResult(request).then(
    (result) => scope.postMessage({ id, result, message: null }, getTransferables(result)),
    (error: unknown) => scope.postMessage({ id, result: null, message: getErrorMessage(error) }, [])
  )
})
