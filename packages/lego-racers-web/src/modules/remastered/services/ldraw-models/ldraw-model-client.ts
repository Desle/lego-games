import { DEVELOPMENT_LDRAW_MODELS_ROUTE, LDRAW_MODEL_INDEX_FILE } from './ldraw-models-route.ts'
import type { LDrawModelIndex } from './ldraw-model-index.types.ts'

const EMPTY_INDEX: LDrawModelIndex = Object.freeze({
  cars: Object.freeze({}),
  chassis: Object.freeze({}),
  drivers: Object.freeze({}),
  powerUps: Object.freeze({}),
  particles: Object.freeze({}),
})

let index: LDrawModelIndex = EMPTY_INDEX
const texts = new Map<string, Promise<string | null>>()

// Reads what the models folder holds, before the viewer draws anything; without the route (no folder, no dev server) it is empty.
export const loadLDrawModelIndex = async (): Promise<LDrawModelIndex> => {
  try {
    const response = await fetch(`${DEVELOPMENT_LDRAW_MODELS_ROUTE}/${LDRAW_MODEL_INDEX_FILE}`)
    index = response.ok ? ((await response.json()) as LDrawModelIndex) : EMPTY_INDEX
  } catch {
    index = EMPTY_INDEX
  }
  return index
}

export const getLDrawModelIndex = (): LDrawModelIndex => index

const fetchText = async (file: string): Promise<string | null> => {
  const response = await fetch(`${DEVELOPMENT_LDRAW_MODELS_ROUTE}/${file}`)
  return response.ok ? response.text() : null
}

// The model file's text, read once (a reload of the page reads the folder again).
export const loadLDrawModelText = (file: string): Promise<string | null> => {
  const cached = texts.get(file) ?? fetchText(file)
  texts.set(file, cached)
  return cached
}
