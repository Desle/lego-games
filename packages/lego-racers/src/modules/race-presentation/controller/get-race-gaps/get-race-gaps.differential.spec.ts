import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import { getRaceGaps } from './get-race-gaps.ts'
import type { RaceGap, RaceGapRacer } from './get-race-gaps.types.ts'

const GAPS_ADDRESS = 0x0043cf30
const CASE_COUNT = 300
const RACER_BYTE_SIZE = 0xe34
const RACER_SET_WORD_COUNT = 0x2a0 / 4
const RACER_SET_WORD = Object.freeze({ racers: 0x140 / 4, count: 0x144 / 4, lapCount: 0x29c / 4 })
const RACER_WORD = Object.freeze({
  currentLap: 0xce4 / 4,
  firstLap: 0xcec / 4,
  position: 0xd00 / 4,
})
const LAP_SLOT_COUNT = 5
const TABLE_LENGTH = 6
const ENTRY_WORD_COUNT = 3

type GapCase = {
  readonly racers: readonly RaceGapRacer[]
  readonly lapCount: number
  readonly racerIndex: number
  readonly previous: readonly RaceGap[]
}

const random = createSeededRandom(0x6a95)

const getCases = (): readonly GapCase[] =>
  Array.from({ length: CASE_COUNT }, () => {
    const lapCount = 1 + random.nextIntegerBelow(LAP_SLOT_COUNT)
    const count = 1 + random.nextIntegerBelow(TABLE_LENGTH)
    const racers = Array.from({ length: count }, (): RaceGapRacer => ({
      currentLap: random.nextIntegerBelow(lapCount + 2),
      lapMilliseconds: Array.from({ length: LAP_SLOT_COUNT }, () =>
        random.nextIntegerBelow(8) === 0
          ? random.nextUnsignedInteger()
          : random.nextIntegerBelow(90_000)
      ),
      racePosition: random.nextIntegerBelow(8),
    }))
    return {
      racers,
      lapCount,
      racerIndex: random.nextIntegerBelow(count),
      previous: Array.from({ length: TABLE_LENGTH }, () => ({
        racerIndex: null,
        gapMilliseconds: random.nextUnsignedInteger() | 0,
        isSet: random.nextIntegerBelow(2) === 0,
      })),
    }
  })

const getRacerWords = (racers: readonly RaceGapRacer[]): readonly number[] => {
  const words = new Array<number>((racers.length * RACER_BYTE_SIZE) / 4).fill(0)
  racers.forEach((racer, index) => {
    const base = (index * RACER_BYTE_SIZE) / 4
    words[base + RACER_WORD.currentLap] = racer.currentLap
    racer.lapMilliseconds.forEach((milliseconds, lap) => {
      words[base + RACER_WORD.firstLap + lap] = milliseconds
    })
    words[base + RACER_WORD.position] = racer.racePosition
  })
  return words
}

const getCall = (testCase: GapCase): EmulatorCall => {
  const racerSet = new Array<EmulatorArgument>(RACER_SET_WORD_COUNT).fill(0)
  racerSet[RACER_SET_WORD.racers] = { buffer: 'racers' }
  racerSet[RACER_SET_WORD.count] = testCase.racers.length
  racerSet[RACER_SET_WORD.lapCount] = testCase.lapCount
  return {
    address: GAPS_ADDRESS,
    convention: 'thiscall',
    precision: 'single',
    arguments: [
      { buffer: 'racerSet' },
      { buffer: 'racers', offset: testCase.racerIndex * RACER_BYTE_SIZE },
      { buffer: 'table' },
    ],
    buffers: [
      { name: 'racerSet', words: racerSet, isRead: false },
      { name: 'racers', words: getRacerWords(testCase.racers), isRead: false },
      {
        name: 'table',
        words: testCase.previous.flatMap((entry) => [
          0,
          entry.gapMilliseconds >>> 0,
          entry.isSet ? 1 : 0,
        ]),
        isRead: true,
      },
    ],
  }
}

// The original's entries name racers by address; the first set entry is racer 0, so the others count from it.
const getOriginalGaps = (words: readonly number[]): readonly RaceGap[] => {
  const firstRacerAddress = words[0] ?? 0
  return Array.from({ length: TABLE_LENGTH }, (_, index) => {
    const address = words[index * ENTRY_WORD_COUNT] ?? 0
    return {
      racerIndex: address === 0 ? null : (address - firstRacerAddress) / RACER_BYTE_SIZE,
      gapMilliseconds: (words[index * ENTRY_WORD_COUNT + 1] ?? 0) | 0,
      isSet: (words[index * ENTRY_WORD_COUNT + 2] ?? 0) !== 0,
    }
  })
}

describe('race gaps 0x0043cf30 against the original', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'fills the table of times behind a racer like the original',
    async () => {
      // Arrange
      const cases = getCases()
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(cases.map(getCall)).finally(() => session.close())
      const mismatches = cases.flatMap((testCase, index) => {
        const original = getOriginalGaps(results[index]?.buffers['table'] ?? [])
        const port = getRaceGaps(
          testCase.racers,
          testCase.lapCount,
          testCase.racerIndex,
          testCase.previous
        )
        return JSON.stringify(original) === JSON.stringify(port) ? [] : [index]
      })

      // Assert
      expect(mismatches).toEqual([])
    },
    120_000
  )
})
