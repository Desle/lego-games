import { getSkyPlacement } from './get-sky-placement.ts'

describe('getSkyPlacement', () => {
  it('puts the dome 10 below the camera and the backdrop 30 above it for a sky without a height', () => {
    // Arrange
    const camera = { x: 3, y: -4, z: 5 }

    // Act
    const placement = getSkyPlacement(camera, 0)

    // Assert
    expect(placement.dome).toEqual({ x: 3, y: -4, z: -5 })
    expect(placement.backdrop).toEqual({ x: 3, y: -4, z: 35 })
  })

  it('lowers the dome by the SKB height less than the reference and leaves the backdrop alone', () => {
    // Arrange
    const camera = { x: 0, y: 0, z: 0 }

    // Act
    const placement = getSkyPlacement(camera, 4)

    // Assert
    expect(placement.dome.z).toBe(-6)
    expect(placement.backdrop.z).toBe(30)
  })
})
