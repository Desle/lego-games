import { createSkyDome } from '../create-sky-dome/create-sky-dome.ts'
import { getSkyVertexColors } from './get-sky-vertex-colors.ts'

describe('getSkyVertexColors', () => {
  it('gives each ring of the dome its colour with full alpha', () => {
    // Arrange
    const dome = createSkyDome()

    // Act
    const colors = getSkyVertexColors(dome, [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ])

    // Assert
    expect(colors).toHaveLength(33 * 4)
    expect([...colors.subarray(0, 4)]).toEqual([1, 2, 3, 255])
    expect([...colors.subarray(10 * 4, 11 * 4)]).toEqual([1, 2, 3, 255])
    expect([...colors.subarray(11 * 4, 12 * 4)]).toEqual([4, 5, 6, 255])
    expect([...colors.subarray(32 * 4, 33 * 4)]).toEqual([7, 8, 9, 255])
  })
})
