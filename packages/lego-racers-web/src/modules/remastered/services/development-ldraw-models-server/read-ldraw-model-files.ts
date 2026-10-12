import { readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { LDRAW_MODEL_EXTENSIONS } from '../ldraw-models/ldraw-models-route.ts'
import type { LDrawModelFile } from '../ldraw-models/ldraw-model-index.types.ts'

const getFilesIn = (root: string, subfolder: string): readonly LDrawModelFile[] =>
  readdirSync(join(root, subfolder), { withFileTypes: true }).flatMap((entry) => {
    const path = subfolder === '' ? entry.name : `${subfolder}/${entry.name}`
    if (entry.isDirectory()) return getFilesIn(root, path)
    return LDRAW_MODEL_EXTENSIONS.includes(extname(entry.name).toLowerCase())
      ? [{ path, modifiedMilliseconds: statSync(join(root, path)).mtimeMs }]
      : []
  })

// Every `.ldr` and `.mpd` under the models folder, subfolders included, sorted by path; empty when the folder is missing.
export const readLDrawModelFiles = (root: string): readonly LDrawModelFile[] => {
  try {
    return getFilesIn(root, '').toSorted((first, second) => first.path.localeCompare(second.path))
  } catch {
    return []
  }
}
