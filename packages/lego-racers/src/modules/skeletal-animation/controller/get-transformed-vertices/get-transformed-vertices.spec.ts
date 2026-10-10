import { getTransformedNormals, getTransformedPositions } from './get-transformed-vertices.ts'

// Two bones: the identity, and a quarter turn about z followed by a move of (1, 2, 3).
const matrices = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1,
])

describe('getTransformedPositions', () => {
  it('multiplies each corner as a row vector by the matrix of its bone', () => {
    // Arrange
    const positions = new Float32Array([1, 0, 0, 1, 0, 0])
    const transformIndices = new Uint8Array([0, 1])

    // Act
    const transformed = getTransformedPositions(positions, transformIndices, matrices)

    // Assert
    expect([...transformed]).toEqual([1, 0, 0, 1, 3, 3])
  })

  it('leaves a corner whose bone does not exist as it is', () => {
    // Arrange
    const positions = new Float32Array([4, 5, 6])

    // Act
    const transformed = getTransformedPositions(positions, new Uint8Array([7]), matrices)

    // Assert
    expect([...transformed]).toEqual([4, 5, 6])
  })
})

describe('getTransformedNormals', () => {
  it('rotates a normal without moving it', () => {
    // Arrange
    const normals = new Float32Array([1, 0, 0])

    // Act
    const transformed = getTransformedNormals(normals, new Uint8Array([1]), matrices)

    // Assert
    expect([...transformed]).toEqual([0, 1, 0])
  })
})
