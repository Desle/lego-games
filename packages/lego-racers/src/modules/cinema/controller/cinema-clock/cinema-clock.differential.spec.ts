import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import type { Cinema } from '../../types/cinema.types.ts'
import { getIsCinemaSkipped, stepCinemaClock } from './cinema-clock.ts'
import type { CinemaClock, CinemaSkipInput } from './cinema-clock.types.ts'

const CLOCK_ADDRESS = 0x00406390
const SKIP_ADDRESS = 0x00466ec0
const CASE_COUNT = 2000
// The cinema record is 0xb8 bytes; its timeline lists (+0x2c count, +0x40 active list) stay empty.
const RECORD_WORD_COUNT = 0xb8 / 4
const RECORD_WORD = Object.freeze({
  flags: 0x44 / 4,
  frame: 0x48 / 4,
  length: 0x4c / 4,
  frameMilliseconds: 0x50 / 4,
  sourceRate: 0x54 / 4,
  rate: 0x58 / 4,
})
const RUNNING_FLAG = 1
const AT_END_FLAG = 4
// The cinema widget is 0x2d0 bytes: +0x2b0 the record, +0x2c8 finished, +0x2cc skippable.
const WIDGET_WORD_COUNT = 0x2d0 / 4
const WIDGET_WORD = Object.freeze({ record: 0x2b0 / 4, finished: 0x2c8 / 4, skippable: 0x2cc / 4 })
const EVENT_WORD_COUNT = 4
const RATES: readonly number[] = [15, 24, 25, 30, 60]
const EVENT_CLASSES: readonly number[] = [0, 0x10000000, 0x20000000, 0x30000000, 0x40000000]

type ClockCase = {
  readonly cinema: Cinema
  readonly clock: CinemaClock
  readonly milliseconds: number
}

const createCinema = (lengthFrames: number, framesPerSecond: number): Cinema => ({
  name: 'test',
  lengthFrames,
  framesPerSecond,
  objects: [],
  actions: [],
  dummies: [],
  ambientLights: [],
  directionalLights: [],
})

const random = createSeededRandom(0xc1e3a)

const getClockCases = (): readonly ClockCase[] =>
  Array.from({ length: CASE_COUNT }, () => {
    const framesPerSecond = RATES[random.nextIntegerBelow(RATES.length)] ?? 30
    const lengthFrames = 1 + random.nextIntegerBelow(1500)
    const frameMilliseconds = random.nextIntegerBelow(lengthFrames * 1000)
    return {
      cinema: createCinema(lengthFrames, framesPerSecond),
      clock: {
        frame: Math.floor(frameMilliseconds / 1000),
        frameMilliseconds,
        isAtEnd: random.nextIntegerBelow(20) === 0,
      },
      milliseconds: random.nextIntegerBelow(8) === 0 ? 0 : random.nextIntegerBelow(250),
    }
  })

const getRecordWords = (cinema: Cinema, clock: CinemaClock): readonly number[] => {
  const words = new Array<number>(RECORD_WORD_COUNT).fill(0)
  words[RECORD_WORD.flags] = clock.isAtEnd ? AT_END_FLAG : RUNNING_FLAG
  words[RECORD_WORD.frame] = clock.frame
  words[RECORD_WORD.length] = cinema.lengthFrames
  words[RECORD_WORD.frameMilliseconds] = clock.frameMilliseconds
  words[RECORD_WORD.sourceRate] = cinema.framesPerSecond
  words[RECORD_WORD.rate] = cinema.framesPerSecond
  return words
}

const getClockCall = (testCase: ClockCase): EmulatorCall => ({
  address: CLOCK_ADDRESS,
  convention: 'thiscall',
  precision: 'single',
  arguments: [{ buffer: 'record' }, testCase.milliseconds],
  buffers: [
    { name: 'record', words: getRecordWords(testCase.cinema, testCase.clock), isRead: true },
  ],
})

const getClockFromWords = (words: readonly number[]): CinemaClock => ({
  frame: words[RECORD_WORD.frame] ?? -1,
  frameMilliseconds: words[RECORD_WORD.frameMilliseconds] ?? -1,
  isAtEnd: ((words[RECORD_WORD.flags] ?? 0) & AT_END_FLAG) !== 0,
})

const getSkipCases = (): readonly CinemaSkipInput[] =>
  Array.from({ length: CASE_COUNT }, () => ({
    frame: random.nextIntegerBelow(10) === 0 ? null : random.nextIntegerBelow(80),
    framesPerSecond: RATES[random.nextIntegerBelow(RATES.length)] ?? 30,
    isSkippable: random.nextIntegerBelow(6) !== 0,
    eventCode:
      ((EVENT_CLASSES[random.nextIntegerBelow(EVENT_CLASSES.length)] ?? 0) |
        random.nextIntegerBelow(0x100)) >>>
      0,
    isRepeated: random.nextIntegerBelow(6) === 0,
  }))

const getSkipCall = (input: CinemaSkipInput): EmulatorCall => {
  const widget = new Array<number | { buffer: string }>(WIDGET_WORD_COUNT).fill(0)
  widget[WIDGET_WORD.record] = input.frame === null ? 0 : { buffer: 'record' }
  widget[WIDGET_WORD.skippable] = input.isSkippable ? 1 : 0
  const record = new Array<number>(RECORD_WORD_COUNT).fill(0)
  record[RECORD_WORD.frame] = input.frame ?? 0
  record[RECORD_WORD.rate] = input.framesPerSecond
  // +0x0c the press flag (set: 0x00466ec0 is the press handler), +0x0d the repeat byte.
  const event = [0, input.eventCode, 0, input.isRepeated ? 0x0101 : 0x0001].slice(
    0,
    EVENT_WORD_COUNT
  )
  return {
    address: SKIP_ADDRESS,
    convention: 'thiscall',
    precision: 'single',
    arguments: [{ buffer: 'widget' }, { buffer: 'event' }],
    buffers: [
      { name: 'widget', words: widget, isRead: true },
      { name: 'record', words: record, isRead: false },
      { name: 'event', words: event, isRead: false },
    ],
  }
}

describe('cinema clock 0x00406390 and skip 0x00466ec0 against the original', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'advances the clock and ends a cinema on a key like the original',
    async () => {
      // Arrange
      const clockCases = getClockCases()
      const skipCases = getSkipCases()
      const session = openEmulatorSession()

      // Act
      const clocks = await session.callBatch(clockCases.map(getClockCall))
      const skips = await session
        .callBatch(skipCases.map(getSkipCall))
        .finally(() => session.close())
      const clockMismatches = clockCases.flatMap((testCase, index) => {
        const original = getClockFromWords(clocks[index]?.buffers['record'] ?? [])
        const port = stepCinemaClock(testCase.clock, testCase.cinema, testCase.milliseconds)
        return JSON.stringify(original) === JSON.stringify(port) ? [] : [index]
      })
      const skipMismatches = skipCases.flatMap((input, index) => {
        const result = skips[index]
        const isOriginalSkipped =
          (result?.eax ?? 0) !== 0 && (result?.buffers['widget']?.[WIDGET_WORD.finished] ?? 0) === 1
        return isOriginalSkipped === getIsCinemaSkipped(input) ? [] : [index]
      })

      // Assert
      expect(clockMismatches).toEqual([])
      expect(skipMismatches).toEqual([])
    },
    120_000
  )
})
