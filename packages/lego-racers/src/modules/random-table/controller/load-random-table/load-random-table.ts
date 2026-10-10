import { readPortableExecutableBytes } from '../../types/portable-executable/portable-executable.ts'
import {
  decodeRandomTable,
  RANDOM_TABLE_ADDRESS,
  RANDOM_TABLE_BYTE_LENGTH,
} from '../../types/random-table/random-table.ts'
import type { RandomTable } from '../../types/random-table.types.ts'

// The table is game data: it is read from the player's own LEGORacers.exe, never shipped.
export const loadRandomTable = (executable: Uint8Array): RandomTable =>
  decodeRandomTable(
    readPortableExecutableBytes(executable, RANDOM_TABLE_ADDRESS, RANDOM_TABLE_BYTE_LENGTH)
  )
