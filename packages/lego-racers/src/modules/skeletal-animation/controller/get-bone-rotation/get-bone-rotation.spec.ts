import { getBoneRotation, IDENTITY_BONE_ROTATION } from './get-bone-rotation.ts'

describe('getBoneRotation', () => {
  it('turns the identity quaternion into the identity matrix', () => {
    // Arrange
    const quaternion = [0, 0, 0, 1] as const

    // Act
    const rotation = getBoneRotation(quaternion)

    // Assert
    expect(rotation).toEqual(IDENTITY_BONE_ROTATION)
  })

  it('writes the rows of a quarter turn about z as the standard rotation matrix', () => {
    // Arrange
    const half = Math.fround(Math.SQRT1_2)

    // Act
    const rotation = getBoneRotation([0, 0, half, half])

    // Assert
    const expected = [0, -1, 0, 1, 0, 0, 0, 0, 1]
    rotation.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? Number.NaN, 5))
  })

  it('normalises by dividing 2 by the squared length', () => {
    // Arrange
    const unit = getBoneRotation([0, 0, Math.fround(Math.SQRT1_2), Math.fround(Math.SQRT1_2)])

    // Act
    const scaled = getBoneRotation([
      0,
      0,
      Math.fround(Math.SQRT1_2) * 4,
      Math.fround(Math.SQRT1_2) * 4,
    ])

    // Assert
    scaled.forEach((value, index) => expect(value).toBeCloseTo(unit[index] ?? Number.NaN, 5))
  })

  it('keeps the xx, yy and zz terms in their own diagonal entries', () => {
    // Arrange
    // A half turn about x: w = 0, x = 1.
    // Act
    const rotation = getBoneRotation([1, 0, 0, 0])

    // Assert
    expect([...rotation]).toEqual([1, 0, 0, 0, -1, 0, 0, 0, -1])
  })
})
