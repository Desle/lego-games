import type { BrickFootprint } from '@lego-games/lego-racers/car-builder'
import { getDominantDeckHeight, getGridOffset } from './chassis-grid-offset.ts'

const createFootprint = (): BrickFootprint =>
  Object.freeze({
    width: 10,
    height: 6,
    cells: Uint8Array.from(Array.from({ length: 60 }, () => [0x83, 0]).flat()),
    originVertexIndex: 0,
  })

describe('chassis grid offset', () => {
  it('finds the deck height most attachable cells share', () => {
    // Arrange
    const footprint = createFootprint()

    // Act
    const height = getDominantDeckHeight(footprint)

    // Assert
    expect(height).toBe(24)
  })

  it('centres the grid on a base and puts the first layer on its deck', () => {
    // Arrange
    const footprint = createFootprint()
    const bounds = {
      minimumX: 0,
      maximumX: 200,
      minimumY: -34,
      minimumZ: 20,
      maximumZ: 100,
    }

    // Act
    const offset = getGridOffset(footprint, bounds)

    // Assert
    expect(offset).toEqual({ x: 0, y: -6, z: 0 })
  })

  it('shifts by half a stud for a base of odd length', () => {
    // Arrange
    const footprint = createFootprint()
    const bounds = { minimumX: 30, maximumX: 170, minimumY: -28, minimumZ: 20, maximumZ: 100 }

    // Act
    const offset = getGridOffset(footprint, bounds)

    // Assert
    expect(offset.x).toBe(10)
  })

  it('does not move the grid without a base', () => {
    // Arrange
    const footprint = createFootprint()

    // Act
    const offset = getGridOffset(footprint, null)

    // Assert
    expect(offset).toEqual({ x: 0, y: 0, z: 0 })
  })
})
