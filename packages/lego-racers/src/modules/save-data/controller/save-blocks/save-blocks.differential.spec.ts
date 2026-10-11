import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import { BLOCK_DATA_BYTE_COUNT } from '../../types/save-layout/save-layout.ts'
import { getBlockChecksum } from './save-blocks.ts'

const CHECKSUM_ADDRESS = 0x004429d0
const CASE_COUNT = 1500
const BYTES_PER_WORD = 4

const getCases = (): readonly Uint8Array[] => {
  const random = createSeededRandom(0xc0de)
  return Array.from({ length: CASE_COUNT }, () => {
    const length =
      random.nextIntegerBelow(3) === 0 ? random.nextIntegerBelow(200) : BLOCK_DATA_BYTE_COUNT
    return Uint8Array.from({ length }, () => random.nextIntegerBelow(256))
  })
}

const getCall = (bytes: Uint8Array): EmulatorCall => {
  const padded = new Uint8Array(Math.ceil((bytes.byteLength + 1) / BYTES_PER_WORD) * BYTES_PER_WORD)
  padded.set(bytes)
  const view = new DataView(padded.buffer)
  return {
    address: CHECKSUM_ADDRESS,
    convention: 'cdecl',
    precision: 'single',
    arguments: [{ buffer: 'data' }, bytes.byteLength],
    buffers: [
      {
        name: 'data',
        words: Array.from({ length: padded.byteLength / BYTES_PER_WORD }, (_, index) =>
          view.getUint32(index * BYTES_PER_WORD, true)
        ),
        isRead: false,
      },
    ],
  }
}

describe('FUN_004429d0 (the sum of a save block) against the original', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'adds the same bytes as the original',
    async () => {
      // Arrange
      const cases = getCases()
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(cases.map(getCall)).finally(() => session.close())
      const mismatches = cases.flatMap((bytes, index) =>
        ((results[index]?.eax ?? -1) & 0xff) === getBlockChecksum(bytes, 0, bytes.byteLength)
          ? []
          : [index]
      )

      // Assert
      expect(mismatches).toEqual([])
    },
    120_000
  )
})
