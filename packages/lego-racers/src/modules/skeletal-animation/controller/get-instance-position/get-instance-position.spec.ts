import { getInstancePosition } from './get-instance-position.ts'

describe('getInstancePosition', () => {
  it('adds the velocity times the elapsed milliseconds to each component', () => {
    // Arrange
    const position = [1, 2, 3] as const
    const velocity = [0.5, -1, 0] as const

    // Act
    const moved = getInstancePosition(position, velocity, 4)

    // Assert
    expect(moved).toEqual([3, -2, 3])
  })

  it('stays where it is without velocity', () => {
    // Arrange
    // Act
    const moved = getInstancePosition([1, 2, 3], [0, 0, 0], 40)

    // Assert
    expect(moved).toEqual([1, 2, 3])
  })
})
