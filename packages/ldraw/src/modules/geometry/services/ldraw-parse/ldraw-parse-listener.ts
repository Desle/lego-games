import { buildParseResult, getTransferables } from './ldraw-parse-work.ts'
import type { ParseWorkerScope, SubModelSplitter } from './ldraw-parse.types.ts'

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// Called by the app's worker script: the library's parser, the merging and the baking run there, off the page's thread, so a model
// that loads does not stall the scene that is drawing.
export const listenForParseRequests = (splitSubModels: SubModelSplitter | null) => {
  const scope = globalThis as unknown as ParseWorkerScope
  scope.addEventListener('message', (event) => {
    const { id, request } = event.data
    buildParseResult(request, splitSubModels).then(
      (result) => scope.postMessage({ id, result, message: null }, getTransferables(result)),
      (error: unknown) =>
        scope.postMessage({ id, result: null, message: getErrorMessage(error) }, [])
    )
  })
}
