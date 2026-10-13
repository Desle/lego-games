import { mkdirSync, renameSync } from 'node:fs'
import { extname, join } from 'node:path'
import { getFileUnder, getSafeRelativePath } from '../ldraw-file-paths/ldraw-file-paths.ts'
import { getBackupPath } from '../ldraw-model-save/ldraw-model-save.ts'
import type { LDrawModelRemoveResult } from './ldraw-model-remove.types.ts'

const REMOVABLE_EXTENSION = '.ldr'

// Takes a model out of the models folder by moving it to `<backupFolder>/<name>-<time>.ldr`, never deleting it. A string says why
// nothing moved: a path that is not an `.ldr` file inside the folder, or no such file.
export const removeLDrawModel = (
  modelsRoot: string,
  requested: string,
  backupFolder: string,
  now: Date
): LDrawModelRemoveResult | string => {
  const file = getSafeRelativePath(requested)
  if (file === null || extname(file).toLowerCase() !== REMOVABLE_EXTENSION) {
    return `${requested} is not an .ldr model file inside the models folder`
  }
  const path = getFileUnder(modelsRoot, file)
  if (path === null) return `${file} is not in the models folder`
  const backupPath = getBackupPath(file, backupFolder, now)
  mkdirSync(join(modelsRoot, backupFolder), { recursive: true })
  renameSync(path, join(modelsRoot, backupPath))
  return Object.freeze({ path: file, backupPath })
}
