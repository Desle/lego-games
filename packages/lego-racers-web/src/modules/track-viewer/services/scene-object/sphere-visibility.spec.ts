import { getIsSphereInFrustum } from './sphere-visibility.ts'

const view = {
  eye: { x: 0, y: 0, z: 0 },
  planes: [[1, 0, 0, 0]] as const,
}

describe('getIsSphereInFrustum', () => {
  it('keeps a sphere whose centre is in front of the plane', () => {
    // Arrange
    const centre = { x: 5, y: 0, z: 0 }

    // Act
    const isVisible = getIsSphereInFrustum(view, centre, 1)

    // Assert
    expect(isVisible).toBe(true)
  })

  it('keeps a sphere that reaches over the plane', () => {
    // Arrange
    const centre = { x: -5, y: 0, z: 0 }

    // Act
    const isVisible = getIsSphereInFrustum(view, centre, 6)

    // Assert
    expect(isVisible).toBe(true)
  })

  it('leaves out a sphere that lies wholly behind the plane (GolDP.dll 0x1002bc20)', () => {
    // Arrange
    const centre = { x: -5, y: 0, z: 0 }

    // Act
    const isVisible = getIsSphereInFrustum(view, centre, 4)

    // Assert
    expect(isVisible).toBe(false)
  })
})
