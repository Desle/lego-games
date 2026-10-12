import { getWheelSet, LDRAW_WHEEL_SETS } from './ldraw-wheel-sets.ts'
import { WheelKind } from './ldraw-wheel-sets.types.ts'

describe('getWheelSet', () => {
  it('takes the tread set whose tyre is nearest in size', () => {
    // Arrange
    const diameters = [40, 52, 70, 100, 130, 300]

    // Act
    const parts = diameters.map((diameter) => getWheelSet(WheelKind.OFFROAD, diameter).tyrePart)

    // Assert
    expect(parts).toEqual(['51011', '56890', '30391', '2696', '2857', '4410'])
  })

  it('draws a wooden wagon wheel as one wooden part, without a tyre', () => {
    // Arrange
    const diameter = 69

    // Act
    const set = getWheelSet(WheelKind.WOODEN_SPOKED, diameter)

    // Assert
    expect(set).toMatchObject({ tyrePart: null, rimPart: '2470', rimColorCode: 70 })
  })

  it('draws a slick as a smooth tyre', () => {
    // Arrange
    const diameter = 40

    // Act
    const set = getWheelSet(WheelKind.SLICK, diameter)

    // Assert
    expect(set.tyrePart).toBe('30028b')
  })

  it('lists every kind from the smallest wheel to the largest', () => {
    // Arrange
    const kinds = Object.values(WheelKind)

    // Act
    const isSorted = kinds.map((kind) => {
      const diameters = LDRAW_WHEEL_SETS[kind].map((set) => set.diameter)
      return diameters.join() === [...diameters].sort((first, second) => first - second).join()
    })

    // Assert
    expect(isSorted.every(Boolean)).toBe(true)
  })
})
