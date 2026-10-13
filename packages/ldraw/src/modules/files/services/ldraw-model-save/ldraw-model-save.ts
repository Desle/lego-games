import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { getSafeRelativePath } from '../ldraw-file-paths/ldraw-file-paths.ts'
import { getIsLDrawModelPath } from '../ldraw-model-files/ldraw-model-files.ts'
import type { LDrawModelSave, LDrawModelSaveResult } from './ldraw-model-save.types.ts'

const MAXIMUM_MODEL_BYTES = 2_000_000
const LDRAW_LINE = /^[0-5](\s|$)/
export const DEFAULT_BACKUP_FOLDER = 'drafts/backups'

export const getIsLDrawText = (text: string): boolean =>
  text.length <= MAXIMUM_MODEL_BYTES &&
  text.split(/\r?\n/).every((line) => line.trim() === '' || LDRAW_LINE.test(line.trim()))

const getTimestamp = (now: Date): string => now.toISOString().replace(/[:.]/g, '-')

// Writes a model into the models folder after copying the file it replaces to `<backupFolder>/<name>-<time>.<extension>`. A string
// says why nothing was written: a path that is not a model file inside the folder, or a text that is not LDraw.
export const saveLDrawModel = (
  modelsRoot: string,
  save: LDrawModelSave,
  backupFolder: string,
  now: Date
): LDrawModelSaveResult | string => {
  const file = getSafeRelativePath(save.path)
  if (file === null || !getIsLDrawModelPath(file)) {
    return `${save.path} is not a model file inside the models folder`
  }
  if (!getIsLDrawText(save.text)) return 'the text is not an LDraw model'
  const path = join(modelsRoot, file)
  const backupPath = existsSync(path)
    ? `${backupFolder}/${basename(file, extname(file))}-${getTimestamp(now)}${extname(file)}`
    : null
  if (backupPath !== null) {
    mkdirSync(join(modelsRoot, backupFolder), { recursive: true })
    copyFileSync(path, join(modelsRoot, backupPath))
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, save.text)
  return Object.freeze({ path: file, backupPath })
}
