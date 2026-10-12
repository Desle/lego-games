import {
  createDefaultProfile,
  getIsCircuitUnlocked,
  getAreAllGhostsBeaten,
} from '@lego-games/lego-racers/save-data'
import { getSaveWithEverythingUnlocked } from './development-unlocks.ts'

describe('getSaveWithEverythingUnlocked', () => {
  it('unlocks every circuit and beats every ghost', () => {
    // Arrange
    const save = { profile: createDefaultProfile(0), racers: [] }

    // Act
    const unlocked = getSaveWithEverythingUnlocked(save)

    // Assert
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((index) => getIsCircuitUnlocked(unlocked.profile, index))
    ).toEqual(Array.from({ length: 7 }, () => true))
    expect(getAreAllGhostsBeaten(unlocked.profile)).toBe(true)
  })
})
