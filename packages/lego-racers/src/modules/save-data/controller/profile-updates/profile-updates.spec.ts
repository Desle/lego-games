import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseSaveFile } from '../parse-save-file/parse-save-file.ts'
import { BestTimeKind } from '../../types/progression-flags/progression-flags.ts'
import {
  createDefaultProfile,
  getAreAllGhostsBeaten,
  getBestTime,
  getBestTimeTrackIndex,
  getIsCircuitUnlocked,
  getIsPartUnlocked,
  getUnlockedCircuitRunLength,
  markGhostBeaten,
  recordBestTime,
  setTrophyFlags,
  unlockCircuit,
} from './profile-updates.ts'

describe('profile updates', () => {
  it('starts with only the first circuit unlocked', () => {
    // Arrange
    const profile = createDefaultProfile(0)

    // Act
    const unlocked = [0, 1, 2].map((circuit) => getIsCircuitUnlocked(profile, circuit))

    // Assert
    expect(unlocked).toEqual([true, false, false])
    expect(getUnlockedCircuitRunLength(profile)).toBe(0)
  })

  it('unlocks circuits one bit at a time and counts the run from circuit 1', () => {
    // Arrange
    const profile = createDefaultProfile(0)

    // Act
    const unlocked = unlockCircuit(unlockCircuit(profile, 1), 2)
    const gap = unlockCircuit(unlocked, 4)

    // Assert
    expect(getUnlockedCircuitRunLength(unlocked)).toBe(2)
    expect(getUnlockedCircuitRunLength(gap)).toBe(2)
    expect(getIsCircuitUnlocked(gap, 4)).toBe(true)
  })

  it('keeps a best time only when it is strictly better', () => {
    // Arrange
    const profile = createDefaultProfile(0)
    const first = recordBestTime(profile, 5, BestTimeKind.LAP, 31000, 'ASH')

    // Act
    const slower = recordBestTime(first.profile, 5, BestTimeKind.LAP, 31000, 'BEN')
    const faster = recordBestTime(first.profile, 5, BestTimeKind.LAP, 30999, 'BEN')

    // Assert
    expect(first.isRecorded).toBe(true)
    expect(slower.isRecorded).toBe(false)
    expect(getBestTime(slower.profile, 5, BestTimeKind.LAP)).toEqual({
      milliseconds: 31000,
      holderName: 'ASH',
    })
    expect(getBestTime(faster.profile, 5, BestTimeKind.LAP).holderName).toBe('BEN')
    expect(getBestTime(faster.profile, 5, BestTimeKind.RACE).milliseconds).toBe(0)
  })

  it('folds the race index into the thirteen tracks of the table', () => {
    // Arrange
    const raceIndices = [0, 12, 13, 25, 26]

    // Act
    const tracks = raceIndices.map(getBestTimeTrackIndex)

    // Assert
    expect(tracks).toEqual([0, 12, 0, 12, null])
  })

  it('sets the trophy for all twelve ghosts when the last one falls', () => {
    // Arrange
    let profile = createDefaultProfile(0)

    // Act
    const updates = Array.from({ length: 12 }, (_, race) => {
      const update = markGhostBeaten(profile, race)
      profile = update.profile
      return update
    })
    const again = markGhostBeaten(profile, 3)

    // Assert
    expect(updates.map(({ isNewlyBeaten }) => isNewlyBeaten)).toEqual(new Array(12).fill(true))
    expect(updates.map(({ isFinalGhostBeaten }) => isFinalGhostBeaten).lastIndexOf(true)).toBe(11)
    expect(getAreAllGhostsBeaten(profile)).toBe(true)
    expect(profile.trophyFlags).toBe(0x80)
    expect(again.isNewlyBeaten).toBe(false)
  })

  it('ignores a ghost beyond the twelfth race', () => {
    // Arrange
    const profile = createDefaultProfile(0)

    // Act
    const update = markGhostBeaten(profile, 12)

    // Assert
    expect(update).toEqual({ profile, isNewlyBeaten: false, isFinalGhostBeaten: false })
  })

  it('unlocks driver parts by trophy, by ghosts or never', () => {
    // Arrange
    const profile = setTrophyFlags(createDefaultProfile(0), 0b100)

    // Act
    const unlocked = [0, 2, 3, 5, 6, 0x80].map((requirement) =>
      getIsPartUnlocked(profile, requirement)
    )

    // Assert
    expect(unlocked).toEqual([true, true, false, true, false, false])
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'reads the defaults of the shipped save file the way the code builds a new profile',
    () => {
      // Arrange
      const shipped = parseSaveFile(
        openJamArchive(readOriginalJam()).readFile('MENUDATA\\DEFAULT.LRS')
      ).profile

      // Act
      const created = createDefaultProfile(3)

      // Assert
      expect(shipped.racerCountOption).toBe(created.racerCountOption)
      expect(shipped.trophyFlags).toBe(0)
      expect(shipped.circuitUnlockFlags).toBe(0)
      expect(shipped.bestLapTimes).toEqual(created.bestLapTimes)
      expect(shipped.optionBytes.slice(0, 5)).toEqual(created.optionBytes.slice(0, 5))
    }
  )
})
