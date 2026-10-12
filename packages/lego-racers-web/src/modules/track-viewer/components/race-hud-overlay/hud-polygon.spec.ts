import { getTextureTransform } from './hud-polygon.ts'

const getVertex = (x: number, y: number, u: number, v: number) => ({
  x,
  y,
  u,
  v,
  color: 0xffffffff,
})

describe('getTextureTransform', () => {
  it('carries the bottom-left of the picture to the vertex with v = 0', () => {
    // Arrange: a 128 x 128 picture on a 64 x 64 rectangle at (100, 200): v = 1 is the top edge
    const vertices = [
      getVertex(100, 200, 0, 1),
      getVertex(164, 200, 1, 1),
      getVertex(100, 264, 0, 0),
    ] as const

    // Act
    const transform = getTextureTransform(vertices, 128, 128)

    // Assert
    expect(transform).toEqual({
      xFromX: 0.5,
      yFromX: 0,
      xFromY: 0,
      yFromY: 0.5,
      xOffset: 100,
      yOffset: 200,
    })
  })

  it('mirrors the picture when v runs the other way', () => {
    // Arrange
    const vertices = [
      getVertex(100, 200, 0, 0),
      getVertex(164, 200, 1, 0),
      getVertex(100, 264, 0, 1),
    ] as const

    // Act
    const transform = getTextureTransform(vertices, 128, 128)

    // Assert
    expect(transform).toEqual({
      xFromX: 0.5,
      yFromX: 0,
      xFromY: 0,
      yFromY: -0.5,
      xOffset: 100,
      yOffset: 264,
    })
  })

  it('has no transform for a triangle without area in the picture', () => {
    // Arrange
    const vertices = [
      getVertex(0, 0, 0, 0),
      getVertex(10, 0, 0, 0),
      getVertex(0, 10, 0, 0),
    ] as const

    // Act / Assert
    expect(getTextureTransform(vertices, 128, 128)).toBeNull()
  })
})
