import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { getEmitterBasis, getEmitterVelocity } from './emitter-basis.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)

describe('getEmitterBasis', () => {
  it('puts the facing in row 0, the cross product in row 1 and the orthogonal up direction in row 2', () => {
    // Arrange
    const facing = { x: 0, y: 2, z: 0 }
    const up = { x: 0, y: 0.5, z: 1 }

    // Act
    const basis = getEmitterBasis(arithmetic, facing, up)

    // Assert
    expect(basis).toEqual([0, 1, 0, -1, 0, 0, 0, 0, 1])
  })
})

describe('getEmitterVelocity', () => {
  it('turns a point by the basis and adds the velocity offset', () => {
    // Arrange
    const basis = [0, 1, 0, -1, 0, 0, 0, 0, 1] as const

    // Act
    const velocity = getEmitterVelocity(
      arithmetic,
      basis,
      { x: 1, y: 2, z: 3 },
      { x: 0.5, y: 0, z: -1 }
    )

    // Assert
    expect(velocity).toEqual({ x: -1.5, y: 1, z: 2 })
  })
})
