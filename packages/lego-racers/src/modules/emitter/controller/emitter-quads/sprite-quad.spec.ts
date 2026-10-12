import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { getSpriteQuad } from './emitter-quads.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const axes = { right: { x: 0, y: -1, z: 0 }, down: { x: 0, y: 0, z: -1 } }

describe('getSpriteQuad', () => {
  it('centres a rectangle of the sprite size on the position with the whole picture on it', () => {
    // Arrange
    const sprite = { materialName: 'cannon', position: { x: 10, y: 0, z: 0 }, width: 4, height: 2 }

    // Act
    const quad = getSpriteQuad(arithmetic, axes, sprite)

    // Assert
    expect(quad.materialName).toBe('cannon')
    expect(
      quad.corners.map((corner) => [corner.x, corner.y, corner.z, corner.u, corner.v])
    ).toEqual([
      [10, 2, -1, 0, 1],
      [10, 2, 1, 0, 0],
      [10, -2, 1, 1, 0],
      [10, -2, -1, 1, 1],
    ])
  })
})
