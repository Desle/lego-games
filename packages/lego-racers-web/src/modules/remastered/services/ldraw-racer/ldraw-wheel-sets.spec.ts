import { getWheelSet, LDRAW_WHEEL_SETS } from './ldraw-wheel-sets.ts'

describe('getWheelSet', () => {
  it('takes the set whose tyre is nearest in size', () => {
    // Arrange
    const diameters = [40, 52, 70, 100, 130, 300]

    // Act
    const parts = diameters.map((diameter) => getWheelSet(diameter).tyrePart)

    // Assert
    expect(parts).toEqual(['51011', '56890', '30391', '2696', '2857', '4410'])
  })

  it('lists the sets from the smallest tyre to the largest', () => {
    // Arrange
    const diameters = LDRAW_WHEEL_SETS.map((set) => set.diameter)

    // Act
    const sorted = [...diameters].sort((first, second) => first - second)

    // Assert
    expect(diameters).toEqual(sorted)
  })
})
