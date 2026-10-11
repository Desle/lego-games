import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type { EmulatorCall } from '../../../../shared/emulator/emulator-client.types.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import { CHAMPION_GHOST_COUNT } from '../../types/progression-flags/progression-flags.ts'
import { createDefaultProfile, markGhostBeaten } from './profile-updates.ts'

const GHOST_FLAG_ADDRESS = 0x0042f250
const CASE_COUNT = 2000
const RECORD_WORD_COUNT = 0x20
// The profile's ghost flags are the 16-bit value at +0x26; the dirty flag is the first dword.
const FLAGS_WORD_INDEX = 0x24 / 4
const FLAGS_SHIFT_IN_WORD = 16

type Case = {
  readonly flags: number
  readonly raceIndex: number
}

const getCases = (): readonly Case[] => {
  const random = createSeededRandom(0xfeed)
  return Array.from({ length: CASE_COUNT }, () => ({
    flags: random.nextUnsignedInteger() & 0xfff,
    raceIndex: random.nextIntegerBelow(CHAMPION_GHOST_COUNT),
  }))
}

const getCall = (testCase: Case): EmulatorCall => {
  const words = new Array<number>(RECORD_WORD_COUNT).fill(0)
  words[FLAGS_WORD_INDEX] = (testCase.flags << FLAGS_SHIFT_IN_WORD) >>> 0
  return {
    address: GHOST_FLAG_ADDRESS,
    convention: 'thiscall',
    precision: 'single',
    arguments: [{ buffer: 'profile' }, 1 << testCase.raceIndex],
    buffers: [{ name: 'profile', words, isRead: true }],
  }
}

describe('FUN_0042f250 (a champion ghost is beaten) against the original', () => {
  it.skipIf(!getIsEmulatorAvailable())(
    'sets the race bit and says whether it was new like the original',
    async () => {
      // Arrange
      const cases = getCases()
      const session = openEmulatorSession()

      // Act
      const results = await session.callBatch(cases.map(getCall)).finally(() => session.close())
      const mismatches = cases.flatMap((testCase, index) => {
        const update = markGhostBeaten(
          { ...createDefaultProfile(0), ghostBeatenFlags: testCase.flags },
          testCase.raceIndex
        )
        const original = results[index]
        const originalFlags =
          (original?.buffers['profile']?.[FLAGS_WORD_INDEX] ?? 0) >>> FLAGS_SHIFT_IN_WORD
        const isSame =
          ((original?.eax ?? 0) & 0xff) === (update.isNewlyBeaten ? 1 : 0) &&
          originalFlags === update.profile.ghostBeatenFlags
        return isSame ? [] : [index]
      })

      // Assert
      expect(mismatches).toEqual([])
    },
    120_000
  )
})
