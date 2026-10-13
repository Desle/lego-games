import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { Buffer } from 'node:buffer'
import { basename, dirname, extname, join } from 'node:path'
import { readLDrawModelFiles } from '../development-ldraw-models-server/read-ldraw-model-files.ts'
import { LDRAW_CHASSIS_FOLDER } from '../ldraw-models/ldraw-models-route.ts'
import { getBuilderItemFile } from './builder-items.ts'
import { BUILDER_BACKUP_FOLDER, BUILDER_PROGRESS_STORE } from './ldraw-builder-route.ts'
import type {
  BuilderProgress,
  BuilderSaveRequest,
  BuilderSaveResult,
  LibraryPart,
} from './ldraw-builder.types.ts'

const PARTS_FOLDER = 'parts'
const HEADER_BYTES = 200
const MAXIMUM_MODEL_BYTES = 2_000_000
const LDRAW_LINE = /^[0-5](\s|$)/
// Parts the library keeps only for old models or as pieces of others: moved (`~Moved to`), aliases (`=`), sub-parts (`~`), obsolete (`_`).
const HIDDEN_DESCRIPTION = /^[~=_|]|Moved to/

const readFirstLine = (path: string): string => {
  const descriptor = openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(HEADER_BYTES)
    const length = readSync(descriptor, buffer, 0, HEADER_BYTES, 0)
    return buffer.toString('utf8', 0, length).split(/\r?\n/)[0] ?? ''
  } finally {
    closeSync(descriptor)
  }
}

const MOVED_DESCRIPTION = /^~Moved to (\S+)/i

const getPartNumber = (name: string): string => name.replace(/\.dat$/i, '').toLowerCase()

// Every part of the library's `parts` folder that a builder would place, by file name, with the description of its first line. A
// part the library renumbered keeps its old numbers in its description ("was 4073"), so searching the number on a set's list finds it.
export const readLibraryParts = (libraryRoot: string): readonly LibraryPart[] => {
  const folder = join(libraryRoot, PARTS_FOLDER)
  if (!existsSync(folder)) return []
  const all = readdirSync(folder)
    .filter((name) => extname(name).toLowerCase() === '.dat')
    .map((name) => ({ name, description: readFirstLine(join(folder, name)).replace(/^0\s*/, '') }))
  const oldNumbers = new Map<string, readonly string[]>()
  for (const part of all) {
    const target = MOVED_DESCRIPTION.exec(part.description)?.[1]?.toLowerCase()
    if (target !== undefined) {
      oldNumbers.set(target, [...(oldNumbers.get(target) ?? []), getPartNumber(part.name)])
    }
  }
  return all
    .filter((part) => part.description !== '' && !HIDDEN_DESCRIPTION.test(part.description))
    .map((part) => {
      const old = oldNumbers.get(getPartNumber(part.name))
      return old === undefined
        ? part
        : { ...part, description: `${part.description} (was ${old.join(', ')})` }
    })
    .sort((first, second) => first.name.localeCompare(second.name, 'en', { numeric: true }))
}

export const readBuilderProgress = (modelsRoot: string): BuilderProgress => {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(join(modelsRoot, BUILDER_PROGRESS_STORE), 'utf8')
    )
    const done =
      typeof parsed === 'object' &&
      parsed !== null &&
      'done' in parsed &&
      Array.isArray(parsed.done)
        ? parsed.done.filter((entry): entry is string => typeof entry === 'string')
        : []
    return Object.freeze({ done: Object.freeze(done) })
  } catch {
    return Object.freeze({ done: Object.freeze([]) })
  }
}

export const writeBuilderProgress = (modelsRoot: string, progress: BuilderProgress) => {
  mkdirSync(modelsRoot, { recursive: true })
  writeFileSync(
    join(modelsRoot, BUILDER_PROGRESS_STORE),
    `${JSON.stringify({ done: [...new Set(progress.done)] }, null, 2)}\n`
  )
}

export const getIsLDrawText = (text: string): boolean =>
  text.length <= MAXIMUM_MODEL_BYTES &&
  text.split(/\r?\n/).every((line) => line.trim() === '' || LDRAW_LINE.test(line.trim()))

const getTimestamp = (now: Date): string => now.toISOString().replace(/[:.]/g, '-')

// Writes an item's model into the models folder (the file the game reads), after copying the file it replaces to
// `drafts/backups/<name>-<time>.ldr`, and marks the item done. A string says why nothing was written.
export const saveBuilderModel = (
  modelsRoot: string,
  request: BuilderSaveRequest,
  now: Date
): BuilderSaveResult | string => {
  const existing = readLDrawModelFiles(modelsRoot)
    .map((file) => file.path)
    .filter((path) => !path.includes('/') || dirname(path) === LDRAW_CHASSIS_FOLDER)
  const file = getBuilderItemFile(request.itemId, existing)
  if (file === null) return `${request.itemId} is not a car or chassis of the builder`
  if (!getIsLDrawText(request.text)) return 'the text is not an LDraw model'
  const path = join(modelsRoot, file)
  const backupPath = existsSync(path)
    ? join(
        BUILDER_BACKUP_FOLDER,
        `${basename(file, extname(file))}-${getTimestamp(now)}${extname(file)}`
      )
    : null
  if (backupPath !== null) {
    mkdirSync(join(modelsRoot, BUILDER_BACKUP_FOLDER), { recursive: true })
    copyFileSync(path, join(modelsRoot, backupPath))
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, request.text)
  const progress = Object.freeze({
    done: Object.freeze([
      ...readBuilderProgress(modelsRoot).done.filter((id) => id !== request.itemId),
      request.itemId,
    ]),
  })
  writeBuilderProgress(modelsRoot, progress)
  return Object.freeze({ path: file, backupPath, progress })
}
