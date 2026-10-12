import type { DecalView } from '../../types/race-presentation.types.ts'
import { getIsDecalWithinDistance } from './get-is-decal-within-distance.ts'

const createView = (maximumSquaredDistance: number | null): DecalView => ({
  imageName: 'crneshd',
  placement: {
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: -1 },
    upHint: { x: 1, y: 0, z: 0 },
    width: 13,
    height: 13,
    depth: 15,
  },
  limits: { maximumTriangles: 32 },
  alpha: null,
  maximumSquaredDistance,
})

describe('getIsDecalWithinDistance', () => {
  it('is always true for a decal without a distance', () => {
    // Arrange
    const view = createView(null)

    // Act
    const isWithin = getIsDecalWithinDistance(view, { x: 1e6, y: 0, z: 0 })

    // Assert
    expect(isWithin).toBe(true)
  })

  it('compares the squared distance strictly', () => {
    // Arrange
    const view = createView(100)

    // Act
    const isAtLimit = getIsDecalWithinDistance(view, { x: 6, y: 8, z: 0 })
    const isBelow = getIsDecalWithinDistance(view, { x: 6, y: 7, z: 0 })

    // Assert
    expect([isAtLimit, isBelow]).toEqual([false, true])
  })
})
