import type { ModelFile } from '../../types/studio.types.ts'
import { readModelFiles } from '../model-files/model-files.ts'
import { MODEL_FILES_FILE, STUDIO_MODELS_URL } from '../studio-routes/studio-routes.constants.ts'

const getModelUrl = (path: string): string =>
  `${STUDIO_MODELS_URL}/${path.split('/').map(encodeURIComponent).join('/')}`

export const getModelFiles = async (): Promise<readonly ModelFile[]> => {
  const response = await fetch(`${STUDIO_MODELS_URL}/${MODEL_FILES_FILE}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${MODEL_FILES_FILE} answered ${String(response.status)}`)
  return readModelFiles(await response.json())
}

export const getModelText = async (path: string): Promise<string | null> => {
  const response = await fetch(getModelUrl(path), { cache: 'no-store' })
  return response.ok ? response.text() : null
}
