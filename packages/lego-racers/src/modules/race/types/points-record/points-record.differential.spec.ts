import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import { createPointsRecord, tickPointsRecord } from './points-record.ts'

const TICK_ADDRESS = 0x00440330
const CASE_COUNT = 2000
// The points record is 0x48 bytes; the countdown is at +0x40.
const RECORD_WORD_COUNT = 0x12
const TICKER_WORD = 0x10

type TickCase = { readonly tickerMilliseconds: number; readonly frameMilliseconds: number }

const getCases = (): readonly TickCase[] => {
  const random = createSeededRandom(0x7ac4)
  return Array.from({ length: CASE_COUNT }, () => ({
    tickerMilliseconds:
      random.nextIntegerBelow(10) === 0
        ? random.nextUnsignedInteger()
        : random.nextIntegerBelow(500),
    frameMilliseconds:
      random.nextIntegerBelow(10) === 0
        ? random.nextUnsignedInteger()
        : random.nextIntegerBelow(200),
  }))
}

const getCall = (testCase: TickCase): EmulatorCall => {
  const words = new Array<number>(RECORD_WORD_COUNT).fill(0)
  words[TICKER_WORD] = testCase.tickerMilliseconds
  return {
    address: TICK_ADDRESS,
    convention: 'thiscall',
    precision: 'single',
    arguments: [{ buffer: 'record' }, testCase.frameMilliseconds],
    buffers: [{ name: 'record', words, isRead: true }],
  }
}

describe('points record countdown 0x00440330 against the original', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'counts down and restarts at 400 like the original',
    async () => {
      // Arrange
      const cases = getCases()
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(cases.map(getCall)).finally(() => session.close())
      const mismatches = cases.flatMap((testCase, index) => {
        const port = tickPointsRecord(
          { ...createPointsRecord(), tickerMilliseconds: testCase.tickerMilliseconds },
          testCase.frameMilliseconds
        )
        const original = results[index]?.buffers['record']?.[TICKER_WORD]
        return original === port.tickerMilliseconds >>> 0 ? [] : [index]
      })

      // Assert
      expect(mismatches).toEqual([])
    },
    120_000
  )
})
