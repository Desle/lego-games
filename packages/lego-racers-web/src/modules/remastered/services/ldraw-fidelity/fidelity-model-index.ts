import {
  DEVELOPMENT_LDRAW_MODELS_ROUTE,
  LDRAW_MODEL_INDEX_FILE,
} from '../ldraw-models/ldraw-models-route.ts'
import { loadLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'

const INDEX_PATH = `${DEVELOPMENT_LDRAW_MODELS_ROUTE}/${LDRAW_MODEL_INDEX_FILE}`

const carFiles = new Map<string, string>()
const pageFetch = globalThis.fetch.bind(globalThis)

const getRequestUrl = (input: Parameters<typeof fetch>[0]): string =>
  input instanceof Request ? input.url : String(input)

// The car drawing finds a car's file in the models folder's index; a draft (`drafts/<CODE>.ldr`) is not in it, so the page answers the
// index with the car's file put in, without touching the drawing's code.
globalThis.fetch = async (input, options) => {
  const response = await pageFetch(input, options)
  if (!getRequestUrl(input).endsWith(INDEX_PATH) || carFiles.size === 0 || !response.ok) {
    return response
  }
  const index = (await response.json()) as LDrawModelIndex
  return new Response(
    JSON.stringify({ ...index, cars: { ...index.cars, ...Object.fromEntries(carFiles) } }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

// Makes the car drawing read this file (relative to the models folder) for the car of this code.
export const loadIndexWithCarFile = async (
  code: string,
  file: string
): Promise<LDrawModelIndex> => {
  carFiles.clear()
  carFiles.set(code, file)
  return loadLDrawModelIndex()
}
