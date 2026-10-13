import { closeSync, existsSync, openSync, readSync, readdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { extname, join } from 'node:path'
import type { LDrawLibraryPart } from './ldraw-library-parts.types.ts'

const PARTS_FOLDER = 'parts'
const HEADER_BYTES = 200
// Parts the library keeps only for old models or as pieces of others: moved (`~Moved to`), aliases (`=`), sub-parts (`~`), obsolete (`_`).
const HIDDEN_DESCRIPTION = /^[~=_|]|Moved to/
const MOVED_DESCRIPTION = /^~Moved to (\S+)/i

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

const getPartNumber = (name: string): string => name.replace(/\.dat$/i, '').toLowerCase()

// Every part of the library's `parts` folder that a builder would place, by file name, with the description of its first line. A
// part the library renumbered keeps its old numbers in its description ("was 4073"), so searching the number on a set's list finds it.
export const readLibraryParts = (libraryRoot: string): readonly LDrawLibraryPart[] => {
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
