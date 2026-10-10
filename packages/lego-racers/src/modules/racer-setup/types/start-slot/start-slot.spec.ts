import { getStartSlot } from './start-slot.ts'

describe('getStartSlot', () => {
  it('gives racer i slot i in a race with one local player', () => {
    // Arrange
    const racerIndices = [0, 1, 2, 3, 4, 5]

    // Act
    const slots = racerIndices.map((racerIndex) => getStartSlot(racerIndex, false))

    // Assert
    expect(slots).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('moves racer 0 to slot 2 when players share the screen (0x0043ba6c)', () => {
    // Arrange
    const racerIndices = [0, 1, 2]

    // Act
    const slots = racerIndices.map((racerIndex) => getStartSlot(racerIndex, true))

    // Assert
    expect(slots).toEqual([2, 1, 2])
  })
})
