import type { BrickFootprint } from '@lego-games/lego-racers/car-builder'
import { getDominantDeckHeight, getGridOffset, getStudAreaBounds } from './chassis-grid-offset.ts'

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

  it('measures a base by its studs, not by the wheel holders that reach past them', () => {
    // Arrange: a 2 x 8 base (studs at x 30..170, z 50 and 70, tops 6 across at y -4), its holders out to z 26 and 94 lower down
    const studTops = [30, 170].flatMap((x) =>
      [50, 70].flatMap((z) => [x - 6, -4, z - 6, x + 6, -4, z + 6])
    )
    const holders = [20, -2, 26, 180, 30, 94]

    // Act
    const bounds = getStudAreaBounds([...holders, ...studTops])

    // Assert
    expect(bounds).toEqual({
      minimumX: 20,
      maximumX: 180,
      minimumY: -4,
      minimumZ: 40,
      maximumZ: 80,
    })
  })

  it('puts the cells of the grid on the studs of a base with wheel holders', () => {
    // Arrange
    const footprint = createFootprint()
    const bounds = getStudAreaBounds([24, -4, 44, 176, -4, 76, 20, 30, 26, 180, 30, 94])

    // Act
    const offset = bounds === null ? null : getGridOffset(footprint, bounds)

    // Assert
    expect([offset?.x, offset?.z]).toEqual([0, 0])
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
