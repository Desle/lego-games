import { WheelKind } from './ldraw-wheel-sets.types.ts'
import { getWheelKind } from './wheel-kind.ts'

describe('getWheelKind', () => {
  it('knows the wooden wagon wheel from its material', () => {
    // Arrange
    const materialName = 'wgnwhl'

    // Act
    const kind = getWheelKind(materialName)

    // Assert
    expect(kind).toBe(WheelKind.WOODEN_SPOKED)
  })

  it('tells slicks, knobbly tyres and spoked tyres apart', () => {
    // Arrange
    const materialNames = ['mate2144', 'mate2628', 'advn_tr1']

    // Act
    const kinds = materialNames.map(getWheelKind)

    // Assert
    expect(kinds).toEqual([WheelKind.SLICK, WheelKind.OFFROAD, WheelKind.SPOKED_OFFROAD])
  })

  it('takes an unknown wheel for a drum', () => {
    // Arrange
    const materialName = 'unknown'

    // Act
    const kind = getWheelKind(materialName)

    // Assert
    expect(kind).toBe(WheelKind.DRUM)
  })
})
