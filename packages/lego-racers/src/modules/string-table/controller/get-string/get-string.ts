import { StringTableOverreadError } from '../../types/string-table-errors/string-table-errors.ts'
import type { StringTable } from '../../types/string-table.types.ts'

// LEGORacers.exe 0x0044e540 returns characters + offsets[index], and null only when index > count.
export const getString = (table: StringTable, index: number): string | null => {
  if (index > table.offsets.length) return null
  const offset = table.offsets[index]
  if (offset === undefined) throw new StringTableOverreadError(index)
  let end = offset
  while (table.characters[end] !== 0) {
    if (end >= table.characters.length) throw new StringTableOverreadError(index)
    end += 1
  }
  return String.fromCharCode(...table.characters.slice(offset, end))
}
