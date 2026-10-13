import { readdirSync, statSync } from 'node:fs'
import { extname, join, posix } from 'node:path'
import type { LDrawModelFile, LDrawModelFolders } from './ldraw-model-files.types.ts'

export const LDRAW_MODEL_EXTENSIONS: readonly string[] = ['.ldr', '.mpd']

export const getIsLDrawModelPath = (path: string): boolean =>
  LDRAW_MODEL_EXTENSIONS.includes(extname(path).toLowerCase())

const getFilesIn = (root: string, subfolder: string): readonly LDrawModelFile[] =>
  readdirSync(join(root, subfolder), { withFileTypes: true }).flatMap((entry) => {
    const path = subfolder === '' ? entry.name : `${subfolder}/${entry.name}`
    if (entry.isDirectory()) return getFilesIn(root, path)
    return getIsLDrawModelPath(entry.name)
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

const getFolder = (path: string): string => {
  const folder = posix.dirname(path)
  return folder === '.' ? '' : folder
}

// The model files of the models folder grouped by the folder they are in.
export const readLDrawModelFolders = (root: string): LDrawModelFolders => {
  const folders = new Map<string, readonly string[]>()
  for (const { path } of readLDrawModelFiles(root)) {
    const folder = getFolder(path)
    folders.set(folder, [...(folders.get(folder) ?? []), posix.basename(path)])
  }
  return Object.freeze(
    Object.fromEntries([...folders].map(([folder, names]) => [folder, Object.freeze(names)]))
  )
}
