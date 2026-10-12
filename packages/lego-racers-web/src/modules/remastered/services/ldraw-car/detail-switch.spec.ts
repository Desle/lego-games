import { Group, PerspectiveCamera } from 'three'
import { DetailSwitch, getHighDetailDistance, setIsShadowRenderActive } from './detail-switch.ts'

const createCamera = (distance: number): PerspectiveCamera => {
  const camera = new PerspectiveCamera(65)
  camera.position.set(0, 0, distance)
  camera.updateMatrixWorld(true)
  return camera
}

describe('getHighDetailDistance', () => {
  it('lets the logo studs go further on a taller screen', () => {
    // Arrange
    const heights = [390, 720, 1440]

    // Act
    const distances = heights.map((height) => Math.round(getHighDetailDistance(height, 65)))

    // Assert
    expect(distances).toEqual([262, 484, 969])
  })
})

describe('DetailSwitch', () => {
  it('draws the plain model far away and the logo model up close', () => {
    // Arrange
    globalThis.innerHeight = 720
    const detail = new DetailSwitch()
    const low = new Group()
    const high = new Group()
    detail.setLow(low)
    detail.setHigh(high)

    // Act
    detail.update(createCamera(2000))
    const far = [low.visible, high.visible]
    detail.update(createCamera(100))
    const near = [low.visible, high.visible]

    // Assert
    expect([far, near]).toEqual([
      [true, false],
      [false, true],
    ])
  })

  it('draws the plain model into the shadow map', () => {
    // Arrange
    globalThis.innerHeight = 720
    const detail = new DetailSwitch()
    const low = new Group()
    const high = new Group()
    detail.setLow(low)
    detail.setHigh(high)

    // Act
    setIsShadowRenderActive(true)
    detail.update(createCamera(100))
    setIsShadowRenderActive(false)

    // Assert
    expect([low.visible, high.visible]).toEqual([true, false])
  })

  it('builds the logo model once, when the camera comes near, and not before', async () => {
    // Arrange
    globalThis.innerHeight = 720
    const detail = new DetailSwitch()
    detail.setLow(new Group())
    let buildCount = 0
    detail.setHighLoader(() => {
      buildCount += 1
      return Promise.resolve(new Group())
    })

    // Act
    detail.update(createCamera(5000))
    const buildsFar = buildCount
    detail.update(createCamera(100))
    detail.update(createCamera(100))
    await detail.requestHigh()

    // Assert
    expect([buildsFar, buildCount]).toEqual([0, 1])
  })
})
