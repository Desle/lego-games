import { getUprightRotation } from './frame-matrix.ts'

describe('getUprightRotation', () => {
  it('keeps the first row and makes the third the world up axis', () => {
    // Arrange
    const forward = { x: 0, y: 2, z: 0 }

    // Act
    const rotation = getUprightRotation(forward)

    // Assert
    expect(rotation.map((value) => value + 0)).toEqual([0, 1, 0, -1, 0, 0, 0, 0, 1])
  })

  it('takes the part of up that is perpendicular to a tilted first row', () => {
    // Arrange
    const forward = { x: 1, y: 0, z: 1 }

    // Act
    const rotation = getUprightRotation(forward)

    // Assert
    const [, , , , , , upX, upY, upZ] = rotation
    expect(upX * forward.x + upZ * forward.z).toBeCloseTo(0)
    expect(upY).toBeCloseTo(0)
    expect(upZ).toBeGreaterThan(0)
  })
})
