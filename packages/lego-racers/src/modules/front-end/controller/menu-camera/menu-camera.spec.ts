import { getMenuCamera, getWorldMenuCamera } from './menu-camera.ts'

describe('getMenuCamera', () => {
  it('reads the nine floats and an optional aspect ratio', () => {
    // Arrange
    const values = [1, 2, 3, 4, 5, 6, 36, 5, 800, 1.25]

    // Act
    const camera = getMenuCamera(values)

    // Assert
    expect(camera).toEqual({
      position: [1, 2, 3],
      target: [4, 5, 6],
      fieldOfViewDegrees: 36,
      nearPlane: 5,
      farPlane: 800,
      aspectRatio: 1.25,
      up: [0, 0, 1],
    })
  })

  it('takes the viewport aspect ratio when the item gives none', () => {
    // Arrange
    const values = [0, 0, 0, 1, 0, 0, 60, 1, 1023]

    // Act
    const camera = getMenuCamera(values)

    // Assert
    expect(camera.aspectRatio).toBeNull()
  })
})

describe('getWorldMenuCamera', () => {
  it('looks from the position along the forward vector with the world up and the world planes', () => {
    // Arrange
    const worldCamera = {
      position: { x: 28, y: -10, z: 3 },
      forward: { x: -1, y: 0, z: 0.5 },
      up: { x: 0, y: 0, z: 1 },
      nearPlane: 5,
      farPlane: 800,
      fieldOfViewDegrees: 36,
    }

    // Act
    const camera = getWorldMenuCamera(worldCamera)

    // Assert
    expect(camera).toEqual({
      position: [28, -10, 3],
      target: [27, -10, 3.5],
      fieldOfViewDegrees: 36,
      nearPlane: 5,
      farPlane: 800,
      aspectRatio: null,
      up: [0, 0, 1],
    })
  })
})
