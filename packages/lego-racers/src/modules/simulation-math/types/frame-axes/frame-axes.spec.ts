import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import type { Matrix3 } from '../simulation-math.types.ts'
import {
  getFrameAxes,
  getRotationFromFirstAndSecondAxes,
  getRotationFromFrameAxes,
  getRotationFromThirdAndFirstAxes,
} from './frame-axes.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('getFrameAxes', () => {
  it('returns rows 0 and 2 of the rotation', () => {
    // Arrange
    const rotation: Matrix3 = [1, 2, 3, 4, 5, 6, 7, 8, 9]

    // Act
    const axes = getFrameAxes(rotation)

    // Assert
    expect(axes).toEqual({ first: { x: 1, y: 2, z: 3 }, third: { x: 7, y: 8, z: 9 } })
  })
})

describe('getRotationFromFrameAxes', () => {
  it('normalizes the first axis, makes the third orthogonal to it and crosses them for row 1', () => {
    // Arrange: the third axis leans 1 toward the first, which is removed before normalizing.
    const axes = { first: { x: 2, y: 0, z: 0 }, third: { x: 1, y: 0, z: 3 } }

    // Act
    const rotation = getRotationFromFrameAxes(SINGLE, axes)

    // Assert
    expect(rotation).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })

  it('builds row 1 as third × first', () => {
    // Arrange
    const axes = { first: { x: 0, y: 1, z: 0 }, third: { x: 1, y: 0, z: 0 } }

    // Act
    const rotation = getRotationFromFrameAxes(SINGLE, axes)

    // Assert
    expect(rotation).toEqual([0, 1, 0, 0, 0, 1, 1, 0, 0])
  })
})

describe('getRotationFromFirstAndSecondAxes', () => {
  it('keeps the first axis as row 0, the second made orthogonal as row 1, and crosses them for row 2', () => {
    // Arrange
    const first = { x: 0, y: 2, z: 0 }
    const second = { x: 3, y: 1, z: 0 }

    // Act
    const rotation = getRotationFromFirstAndSecondAxes(SINGLE, first, second)

    // Assert
    expect(rotation).toEqual([0, 1, 0, 1, 0, 0, 0, 0, -1])
  })
})

describe('getRotationFromThirdAndFirstAxes', () => {
  it('keeps the third axis as row 2, the first made orthogonal as row 0, and crosses them for row 1', () => {
    // Arrange
    const third = { x: 0, y: 0, z: 5 }
    const first = { x: 1, y: 0, z: 1 }

    // Act
    const rotation = getRotationFromThirdAndFirstAxes(SINGLE, third, first)

    // Assert
    expect(rotation).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
})
