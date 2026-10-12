import { getExplosionScarPlacement, getOilSlickPlacement } from './decal-placements.ts'

describe('decal placements', () => {
  it('places an oil slick 5 above its ground point, facing down, 15 across', () => {
    // Arrange
    const ground = { x: 10, y: -20, z: 3.25 }

    // Act
    const placement = getOilSlickPlacement(ground)

    // Assert
    expect(placement).toEqual({
      position: { x: 10, y: -20, z: 8.25 },
      normal: { x: 0, y: 0, z: -1 },
      upHint: { x: 1, y: 0, z: 0 },
      width: 15,
      height: 15,
      depth: 15,
    })
  })

  it('places a scar with the size it has grown to and a reach of 15', () => {
    // Arrange
    const burst = { x: 1, y: 2, z: 3 }

    // Act
    const placement = getExplosionScarPlacement(burst, 2.5)

    // Assert
    expect(placement.position).toEqual({ x: 1, y: 2, z: 8 })
    expect([placement.width, placement.height, placement.depth]).toEqual([2.5, 2.5, 15])
  })

  it('rounds the raised height to a float as the engine stores it', () => {
    // Arrange
    const ground = { x: 0, y: 0, z: 0.1 }

    // Act
    const placement = getOilSlickPlacement(ground)

    // Assert
    expect(placement.position.z).toBe(Math.fround(Math.fround(0.1) + 5))
  })
})
