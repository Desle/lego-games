import { DuplicateNameError } from '../errors/gol-file-errors.ts'
import type { NameTable } from './name-table.types.ts'

// GolDP.dll hashes and compares names over at most eight characters (0x100282c0, 0x100283e0).
export const NAME_KEY_LENGTH = 8

const getNameKey = (name: string) => name.slice(0, NAME_KEY_LENGTH)

// The per-object name table of GolDP.dll (allocated by 0x10028250).
export const createNameTable = (): NameTable => {
  const indices = new Map<string, number>()
  return Object.freeze({
    add: (name: string, index: number) => {
      const key = getNameKey(name)
      if (indices.has(key)) throw new DuplicateNameError(name)
      indices.set(key, index)
    },
    find: (name: string) => indices.get(getNameKey(name)) ?? null,
  })
}
