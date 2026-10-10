import { getInstanceRotation } from './instance-rotation.ts'

describe('getInstanceRotation', () => {
  it('builds the identity from the default forward (1, 0, 0) and up (0, 0, 1)', () => {
    // Arrange
    const forward = { x: 1, y: 0, z: 0 }
    const up = { x: 0, y: 0, z: 1 }

    // Act
    const rotation = getInstanceRotation(forward, up)

    // Assert
    expect(rotation).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })

  it('normalises forward and makes up orthogonal to it', () => {
    // Arrange
    const forward = { x: 0, y: 2, z: 0 }
    const up = { x: 0, y: 1, z: 1 }

    // Act
    const rotation = getInstanceRotation(forward, up)

    // Assert
    expect(rotation).toEqual([0, 1, 0, -1, 0, 0, 0, 0, 1])
  })
})
