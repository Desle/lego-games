import { PerspectiveCamera, Vector3 } from 'three'
import { getCameraFrustum, ORIGINAL_FAR_PLANE, ORIGINAL_NEAR_PLANE } from './camera-frustum.ts'

const getIsInside = (
  planes: ReturnType<typeof getCameraFrustum>['planes'],
  point: Vector3
): boolean =>
  planes.every(([x, y, z, offset]) => 0 <= x * point.x + y * point.y + z * point.z + offset)

const createCameraLookingAlongX = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(65, 4 / 3)
  camera.position.set(10, 0, 0)
  camera.up.set(0, 0, 1)
  camera.lookAt(20, 0, 0)
  return camera
}

describe('getCameraFrustum', () => {
  it('has the camera position as the eye', () => {
    // Arrange
    const camera = createCameraLookingAlongX()

    // Act
    const { eye } = getCameraFrustum(camera)

    // Assert
    expect(eye).toEqual({ x: 10, y: 0, z: 0 })
  })

  it('holds a point between the near and far planes in front of the camera', () => {
    // Arrange
    const { planes } = getCameraFrustum(createCameraLookingAlongX())

    // Act
    const isInside = getIsInside(planes, new Vector3(110, 0, 0))

    // Assert
    expect(isInside).toBe(true)
  })

  it.each([
    ['nearer than the near plane', new Vector3(10 + ORIGINAL_NEAR_PLANE - 1, 0, 0)],
    ['farther than the far plane', new Vector3(10 + ORIGINAL_FAR_PLANE + 1, 0, 0)],
    ['behind the camera', new Vector3(0, 0, 0)],
    ['above the field of view', new Vector3(110, 0, 100)],
    ['beside the field of view', new Vector3(110, 100, 0)],
  ])('rejects a point %s', (_name, point) => {
    // Arrange
    const { planes } = getCameraFrustum(createCameraLookingAlongX())

    // Act
    const isInside = getIsInside(planes, point)

    // Assert
    expect(isInside).toBe(false)
  })
})
