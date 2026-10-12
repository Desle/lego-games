import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createScreenFader, startScreenFade, updateScreenFader } from './screen-fader.ts'
import type { ScreenFade } from './screen-fader.types.ts'

const START_ADDRESS = 0x00490550
const UPDATE_ADDRESS = 0x00490590
const CASE_COUNT = 1500
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const WORD_COUNT = 6
const PLAYER_WORD = 1
const COLOUR_WORD = 2
const REMAINING_WORD = 3
const TOTAL_WORD = 4
const FLAGS_WORD = 5
const FLAG_ACTIVE = 1
const FLAG_FADING_OUT = 2
const FLAG_ENDING = 4
const BYTE_MASK = 0xff
const BYTE_BITS = 8

type FadeCase = {
  readonly flags: number
  readonly playerWord: number
  readonly colour: number
  readonly remaining: number
  readonly total: number
  readonly step: number
}

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleFadeCase = (sampler: FloatSampler): FadeCase =>
  Object.freeze({
    flags: sampleChoice(sampler, 0, 1, 3, 5, 7, 2, 4, 6),
    playerWord: sampleChoice(sampler, 0, 1, 2),
    colour: sampleChoice(sampler, 0, 0x640000, 0x123456, 0xffffff),
    remaining: sampleChoice(sampler, 0, 1, 2, 33, 167, 200, 500, 1000),
    total: sampleChoice(sampler, 200, 500, 1000),
    step: sampleChoice(sampler, 0, 1, 33, 34, 40, 100, 5000),
  })

const getWords = (item: FadeCase): readonly number[] => {
  const words = new Array<number>(WORD_COUNT).fill(0)
  words[PLAYER_WORD] = item.playerWord
  words[COLOUR_WORD] = item.colour
  words[REMAINING_WORD] = item.remaining
  words[TOTAL_WORD] = item.total
  words[FLAGS_WORD] = item.flags
  return words
}

const getFade = (item: FadeCase): ScreenFade =>
  Object.freeze({
    isActive: (item.flags & FLAG_ACTIVE) !== 0,
    isFadingOut: (item.flags & FLAG_FADING_OUT) !== 0,
    isEnding: (item.flags & FLAG_ENDING) !== 0,
    red: item.colour & BYTE_MASK,
    green: (item.colour >>> BYTE_BITS) & BYTE_MASK,
    blue: (item.colour >>> (2 * BYTE_BITS)) & BYTE_MASK,
    totalMilliseconds: item.total,
    remainingMilliseconds: item.remaining,
    playerIndex: item.playerWord === 0 ? null : item.playerWord - 1,
  })

// The words 0x00490530 and 0x00490590 leave: the player, the colour, the clock and the flags.
const getFadeWords = (fade: ScreenFade): readonly number[] => [
  fade.playerIndex === null ? 0 : fade.playerIndex + 1,
  fade.red | (fade.green << BYTE_BITS) | (fade.blue << (2 * BYTE_BITS)),
  fade.remainingMilliseconds,
  fade.totalMilliseconds,
  (fade.isActive ? FLAG_ACTIVE : 0) |
    (fade.isFadingOut ? FLAG_FADING_OUT : 0) |
    (fade.isEnding ? FLAG_ENDING : 0),
]

const getOriginalWords = (words: readonly number[]): readonly number[] => [
  words[PLAYER_WORD] ?? 0,
  words[COLOUR_WORD] ?? 0,
  words[REMAINING_WORD] ?? 0,
  words[TOTAL_WORD] ?? 0,
  (words[FLAGS_WORD] ?? 0) & BYTE_MASK,
]

describe.skipIf(!getIsEmulatorAvailable())('the screen fader against the original', () => {
  it(
    '0x00490590 updates an entry like the original',
    async () => {
      // Arrange
      const sampler = createFloatSampler(createSeededRandom(UPDATE_ADDRESS))
      const cases = Array.from({ length: CASE_COUNT }, () => sampleFadeCase(sampler))
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(
        cases.map((item): EmulatorCall => ({
          address: UPDATE_ADDRESS,
          convention: 'thiscall',
          precision: 'single',
          arguments: [{ buffer: 'fade' }, item.step],
          buffers: [{ name: 'fade', words: getWords(item), isRead: true }],
        }))
      )
      await session.close()
      const mismatches = cases.flatMap((item, index) => {
        const original = getOriginalWords(results[index]?.buffers['fade'] ?? [])
        const [updated] = updateScreenFader([getFade(item)], item.step)
        const ported = updated === undefined ? [] : getFadeWords(updated)
        return original.every((word, position) => word === ported[position])
          ? []
          : [`${String(index)}: ${original.join()} against ${ported.join()}`]
      })

      // Assert
      expect(mismatches.slice(0, 8)).toEqual([])
    },
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it(
    '0x00490550 starts an entry like the original',
    async () => {
      // Arrange
      const sampler = createFloatSampler(createSeededRandom(START_ADDRESS))
      const cases = Array.from({ length: CASE_COUNT }, () => ({
        milliseconds: sampleChoice(sampler, 1, 200, 500, 1000),
        isFadingOut: sampler.getIsChance(50),
        playerWord: sampleChoice(sampler, 0, 1, 2),
      }))
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(
        cases.map((item): EmulatorCall => ({
          address: START_ADDRESS,
          convention: 'thiscall',
          precision: 'single',
          arguments: [
            { buffer: 'fade' },
            item.milliseconds,
            item.isFadingOut ? 1 : 0,
            0,
            item.playerWord,
          ],
          buffers: [{ name: 'fade', words: new Array<number>(WORD_COUNT).fill(0), isRead: true }],
        }))
      )
      await session.close()
      const mismatches = cases.flatMap((item, index) => {
        const original = getOriginalWords(results[index]?.buffers['fade'] ?? [])
        const [started] = startScreenFade(
          createScreenFader().slice(0, 1),
          {
            milliseconds: item.milliseconds,
            isFadingOut: item.isFadingOut,
            playerIndex: item.playerWord === 0 ? null : item.playerWord - 1,
          },
          { red: 0, green: 0, blue: 0 }
        )
        const ported = started === undefined ? [] : getFadeWords(started)
        return original.every((word, position) => word === ported[position])
          ? []
          : [`${String(index)}: ${original.join()} against ${ported.join()}`]
      })

      // Assert
      expect(mismatches.slice(0, 8)).toEqual([])
    },
    TEST_TIMEOUT_IN_MILLISECONDS
  )
})
