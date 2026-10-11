import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import type { CircuitStandings } from '../../types/circuit-standings.types.ts'
import { awardPlacePoints, getStandingRank, getStandingTotal } from './standings.ts'

const AWARD_ADDRESS = 0x004402c0
const TOTAL_ADDRESS = 0x004402f0
const RANK_ADDRESS = 0x00440300
const CASE_COUNT = 2000
const RACER_COUNT = 6
// The points record is 0x48 bytes; the totals are at +0x10 and the race points at +0x28.
const RECORD_WORD_COUNT = 0x12
const TOTALS_WORD_OFFSET = 4
const RACE_POINTS_WORD_OFFSET = 10

type Case = {
  readonly standings: CircuitStandings
  readonly racerIndex: number
  readonly place: number
}

const getCases = (): readonly Case[] => {
  const random = createSeededRandom(0x5eed)
  return Array.from({ length: CASE_COUNT }, () => {
    const ranges = [4, 40, 100, 0xffffffff]
    const limit = ranges[random.nextIntegerBelow(ranges.length)] ?? 4
    const getValue = () => random.nextUnsignedInteger() % (limit + 1)
    return {
      standings: {
        totals: Array.from({ length: RACER_COUNT }, getValue),
        racePoints: Array.from({ length: RACER_COUNT }, getValue),
      },
      racerIndex: random.nextIntegerBelow(RACER_COUNT),
      place: random.nextIntegerBelow(RACER_COUNT),
    }
  })
}

const getRecordWords = (standings: CircuitStandings): readonly number[] => {
  const words = new Array<number>(RECORD_WORD_COUNT).fill(0)
  standings.totals.forEach((total, index) => (words[TOTALS_WORD_OFFSET + index] = total))
  standings.racePoints.forEach((points, index) => (words[RACE_POINTS_WORD_OFFSET + index] = points))
  return words
}

const getCall = (address: number, testCase: Case, parameters: readonly number[]): EmulatorCall => ({
  address,
  convention: 'thiscall',
  precision: 'single',
  arguments: [{ buffer: 'record' }, ...parameters],
  buffers: [{ name: 'record', words: getRecordWords(testCase.standings), isRead: true }],
})

const getStandingsFromWords = (words: readonly number[]): CircuitStandings => ({
  totals: words.slice(TOTALS_WORD_OFFSET, TOTALS_WORD_OFFSET + RACER_COUNT),
  racePoints: words.slice(RACE_POINTS_WORD_OFFSET, RACE_POINTS_WORD_OFFSET + RACER_COUNT),
})

describe('circuit standings 0x004402c0, 0x004402f0 and 0x00440300 against the original', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'awards points, reads totals and ranks racers like the original',
    async () => {
      // Arrange
      const cases = getCases()
      const session = openEmulatorSession()

      // Act
      const awards = await session.callBatch(
        cases.map((testCase) =>
          getCall(AWARD_ADDRESS, testCase, [testCase.racerIndex, testCase.place])
        )
      )
      const totals = await session.callBatch(
        cases.map((testCase) => getCall(TOTAL_ADDRESS, testCase, [testCase.racerIndex]))
      )
      const ranks = await session
        .callBatch(cases.map((testCase) => getCall(RANK_ADDRESS, testCase, [testCase.racerIndex])))
        .finally(() => session.close())
      const mismatches = cases.flatMap((testCase, index) => {
        const awarded = awardPlacePoints(testCase.standings, testCase.racerIndex, testCase.place)
        const original = getStandingsFromWords(awards[index]?.buffers['record'] ?? [])
        const isAwardSame = JSON.stringify(original) === JSON.stringify(awarded)
        const isTotalSame =
          totals[index]?.eax === getStandingTotal(testCase.standings, testCase.racerIndex)
        const isRankSame =
          ranks[index]?.eax === getStandingRank(testCase.standings, testCase.racerIndex)
        return isAwardSame && isTotalSame && isRankSame ? [] : [index]
      })

      // Assert
      expect(mismatches).toEqual([])
    },
    120_000
  )
})
