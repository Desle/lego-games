import { loadRandomTable, readPortableExecutableBytes } from '../../../random-table/index.ts'
import { COSINE_TABLE_ADDRESS, COSINE_TABLE_LENGTH } from '../../types/cosine-table/cosine-table.ts'
import type { RacerTables } from '../../types/racer.types.ts'

const FLOAT32_SIZE = 4

// The random table (0x004befec, through random-table) and the cosine table (0x004bf7ec, float32) of LEGORacers.exe.
export const readRacerTables = (executable: Uint8Array): RacerTables => {
  const cosineBytes = readPortableExecutableBytes(
    executable,
    COSINE_TABLE_ADDRESS,
    COSINE_TABLE_LENGTH * FLOAT32_SIZE
  )
  const view = new DataView(cosineBytes.buffer, cosineBytes.byteOffset, cosineBytes.byteLength)
  return Object.freeze({
    randomTable: loadRandomTable(executable),
    cosineValues: Object.freeze(
      Array.from({ length: COSINE_TABLE_LENGTH }, (_, index) =>
        view.getFloat32(index * FLOAT32_SIZE, true)
      )
    ),
  })
}
