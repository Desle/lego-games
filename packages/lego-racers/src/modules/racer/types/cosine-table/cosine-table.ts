import type { RacerTables } from '../racer.types.ts'

export const COSINE_TABLE_ADDRESS = 0x004bf7ec
export const COSINE_TABLE_LENGTH = 1024

// The float32 cosine table at 0x004bf7ec, indexed with `& 0x3ff`.
export const getTableCosine = (tables: RacerTables, index: number): number =>
  tables.cosineValues[index & (COSINE_TABLE_LENGTH - 1)] ?? 0
