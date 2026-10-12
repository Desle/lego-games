import { BRICK_COLOR_COUNT } from './body-colors.ts'
import { fitBodyBricks } from './brick-fit.ts'
import type { BodyVoxels, BrickTemplate } from './opponent-car.types.ts'

const getBoxTemplate = (countX: number, countY: number, countZ: number): BrickTemplate => ({
  pieceName: 'ldraw:test',
  orientation: 0,
  countX,
  countY,
  countZ,
  cells: Array.from({ length: countX * countY * countZ }, (_, index) => [
    index % countX,
    Math.floor(index / countX) % countY,
    Math.floor(index / (countX * countY)),
  ]).flat(),
})

describe('fitBodyBricks', () => {
  it('covers a solid block with one brick of its size', () => {
    // Arrange
    const grid = { countX: 4, countY: 2, countZ: 3, offsetX: 0, offsetY: 0, offsetZ: 0 }
    const voxels: BodyVoxels = {
      grid,
      fill: new Float32Array(24).fill(1),
      colorVotes: new Float32Array(24 * BRICK_COLOR_COUNT),
    }

    // Act
    const { bricks } = fitBodyBricks(voxels, [getBoxTemplate(2, 2, 3), getBoxTemplate(4, 2, 3)])

    // Assert
    expect(bricks).toEqual([
      { pieceName: 'ldraw:test', orientation: 0, x: 0, y: 0, z: 0, colorIndex: -1 },
    ])
  })

  it('places nothing in an empty grid', () => {
    // Arrange
    const grid = { countX: 4, countY: 2, countZ: 3, offsetX: 0, offsetY: 0, offsetZ: 0 }
    const voxels: BodyVoxels = {
      grid,
      fill: new Float32Array(24),
      colorVotes: new Float32Array(24 * BRICK_COLOR_COUNT),
    }

    // Act
    const { bricks } = fitBodyBricks(voxels, [getBoxTemplate(2, 2, 3)])

    // Assert
    expect(bricks).toEqual([])
  })
})
