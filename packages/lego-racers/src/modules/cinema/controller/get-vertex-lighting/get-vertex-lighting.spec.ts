import { getLitVertexColor } from './get-vertex-lighting.ts'

const WHITE = [255, 255, 255] as const

describe('getLitVertexColor', () => {
  it('gives the ambient colour times the material ambient without a light', () => {
    // Arrange
    const input = {
      ambient: WHITE,
      materialAmbient: [128, 64, 0],
      materialDiffuse: WHITE,
      lights: [],
      normal: [0, 0, 1],
    } as const

    // Act
    const color = getLitVertexColor(input)

    // Assert
    expect(color).toEqual([127, 63, 0])
  })

  it('brightens a vertex that faces the light and keeps one that faces away at the ambient', () => {
    // Arrange
    const light = { color: [50, 50, 50], direction: [0, 0, -1] } as const
    const base = {
      ambient: [100, 100, 100],
      materialAmbient: [256, 256, 256],
      materialDiffuse: [256, 256, 256],
      lights: [light],
    } as const

    // Act
    const facing = getLitVertexColor({ ...base, normal: [0, 0, 1] })
    const away = getLitVertexColor({ ...base, normal: [0, 0, -1] })

    // Assert
    expect(facing).toEqual([150, 150, 150])
    expect(away).toEqual([100, 100, 100])
  })
})
