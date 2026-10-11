import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { getDestinationCarryPosition } from './warp-effect.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('getDestinationCarryPosition', () => {
  it('starts at the racer and ends at the destination as the time runs out', () => {
    // Arrange
    const warp = {
      destination: { x: 100, y: 200, z: 300 },
      forward: { x: 1, y: 0, z: 0 },
      start: { x: 0, y: 0, z: 0 },
    }

    // Act
    const atStart = getDestinationCarryPosition(SINGLE, warp, 1500)
    const atEnd = getDestinationCarryPosition(SINGLE, warp, 0)

    // Assert
    expect(atStart?.x).toBeCloseTo(0, 3)
    expect(atStart?.y).toBeCloseTo(0, 3)
    expect(atEnd).toEqual({ x: 100, y: 200, z: 100 })
  })

  it('subtracts the z share from the destination x, as 0x0045d780 does', () => {
    // Arrange
    const warp = {
      destination: { x: 10, y: 0, z: 40 },
      forward: { x: 1, y: 0, z: 0 },
      start: { x: 0, y: 0, z: 0 },
    }

    // Act
    const halfway = getDestinationCarryPosition(SINGLE, warp, 750)

    // Assert
    expect(halfway?.z).toBeCloseTo(10 - 40 * 0.5, 3)
  })

  it('has no position before the carry has a start', () => {
    // Arrange
    const warp = { destination: { x: 1, y: 2, z: 3 }, forward: { x: 1, y: 0, z: 0 }, start: null }

    // Act
    const position = getDestinationCarryPosition(SINGLE, warp, 100)

    // Assert
    expect(position).toBeNull()
  })
})
