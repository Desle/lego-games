import {
  getInverseMatrix,
  getNearerQuaternion,
  getQuaternionOfRowRotation,
} from './transform-math.ts'

describe('getQuaternionOfRowRotation', () => {
  it('gives the identity quaternion for the identity rotation', () => {
    // Arrange
    const rows = [1, 0, 0, 0, 1, 0, 0, 0, 1]

    // Act
    const quaternion = getQuaternionOfRowRotation(rows)

    // Assert
    expect(quaternion).toEqual([0, 0, 0, 1])
  })

  it('turns a row-vector quarter turn about Z into the column-vector quaternion of the same turn', () => {
    // Arrange: row vectors: (1, 0, 0) · rows = (0, 1, 0), a counter-clockwise quarter turn about +Z.
    const rows = [0, 1, 0, -1, 0, 0, 0, 0, 1]

    // Act
    const quaternion = getQuaternionOfRowRotation(rows)

    // Assert
    expect(quaternion[2]).toBeCloseTo(Math.SQRT1_2)
    expect(quaternion[3]).toBeCloseTo(Math.SQRT1_2)
  })
})

describe('getNearerQuaternion', () => {
  it('flips a quaternion that points away from the previous one', () => {
    // Arrange
    const previous = [0, 0, 0, 1] as const

    // Act
    const nearer = getNearerQuaternion(previous, [0, 0, 0, -1])

    // Assert
    expect(nearer).toEqual([-0, -0, -0, 1])
  })
})

describe('getInverseMatrix', () => {
  it('inverts a translation', () => {
    // Arrange
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 4, 5, 1]

    // Act
    const inverse = getInverseMatrix(matrix)

    // Assert
    const expected = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -3, -4, -5, 1]
    for (const [index, value] of expected.entries()) expect(inverse[index]).toBeCloseTo(value, 6)
  })
})
