import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import type { SaveRacer } from '../../types/save-data.types.ts'
import { recordCircuitRank } from './racer-updates.ts'

const RANK_ADDRESS = 0x0042b640
const CASE_COUNT = 3000
const RECORD_WORD_COUNT = 0x91
const RANKS_WORD_INDEX = 0x23c / 4
const RANKS_BYTE_OFFSET_IN_WORD = 3

type Case = {
  readonly circuitRanks: number
  readonly circuitIndex: number
  readonly rank: number
}

const RACER: SaveRacer = {
  name: '',
  colorBytes: [],
  chassisName: '',
  designBytes: [],
  circuitRanks: 0,
}

const getCases = (): readonly Case[] => {
  const random = createSeededRandom(0xbeef)
  return Array.from({ length: CASE_COUNT }, () => ({
    circuitRanks: random.nextUnsignedInteger() & 0xffff,
    circuitIndex: random.nextIntegerBelow(16),
    rank: random.nextIntegerBelow(6),
  }))
}

// The racer record is 0x244 bytes; the ranks are the 16-bit value at +0x23f. The record's first dword is the owner
// pointer the function tells about the change, left null here.
const getCall = (testCase: Case): EmulatorCall => {
  const words = new Array<number>(RECORD_WORD_COUNT).fill(0)
  words[RANKS_WORD_INDEX] = ((testCase.circuitRanks & 0xff) << 24) >>> 0
  words[RANKS_WORD_INDEX + 1] = testCase.circuitRanks >> 8
  return {
    address: RANK_ADDRESS,
    convention: 'thiscall',
    precision: 'single',
    arguments: [{ buffer: 'record' }, testCase.circuitIndex, testCase.rank],
    buffers: [{ name: 'record', words, isRead: true }],
  }
}

const getRanksFromWords = (words: readonly number[]): number =>
  ((words[RANKS_WORD_INDEX] ?? 0) >>> (RANKS_BYTE_OFFSET_IN_WORD * 8)) |
  (((words[RANKS_WORD_INDEX + 1] ?? 0) & 0xff) << 8)

describe('FUN_0042b640 (the racer record keeps a circuit rank) against the original', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'stores and refuses places like the original',
    async () => {
      // Arrange
      const cases = getCases()
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(cases.map(getCall)).finally(() => session.close())
      const mismatches = cases.flatMap((testCase, index) => {
        const update = recordCircuitRank(
          { ...RACER, circuitRanks: testCase.circuitRanks },
          testCase.circuitIndex,
          testCase.rank
        )
        const original = results[index]
        const isSame =
          original?.eax === (update.isRecorded ? 1 : 0) &&
          getRanksFromWords(original.buffers['record'] ?? []) === update.racer.circuitRanks
        return isSame ? [] : [{ index, ...testCase }]
      })

      // Assert
      expect(mismatches).toEqual([])
    },
    120_000
  )
})
