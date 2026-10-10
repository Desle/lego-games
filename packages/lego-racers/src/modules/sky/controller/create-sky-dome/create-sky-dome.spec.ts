import { createSkyDome } from './create-sky-dome.ts'

describe('createSkyDome', () => {
  it('builds three rings of eleven vertices for the dome Sky_Load asks for', () => {
    // Arrange
    // Act
    const dome = createSkyDome()

    // Assert
    expect(dome.ringCount).toBe(3)
    expect(dome.segmentCount).toBe(11)
    expect(dome.vertexCount).toBe(33)
    expect(dome.positions).toHaveLength(33 * 3)
  })

  it('places the first vertex at the first latitude on the x axis', () => {
    // Arrange
    const step = Math.fround(Math.fround(2 * Math.PI) / 11)

    // Act
    const dome = createSkyDome()

    // Assert
    expect(dome.positions[0]).toBeCloseTo(100 * Math.sin(step), 4)
    expect(dome.positions[1]).toBe(0)
    expect(dome.positions[2]).toBeCloseTo(100 * Math.cos(step), 4)
  })

  it('puts the last ring on the equator and the rings at growing distance from the pole', () => {
    // Arrange
    // Act
    const dome = createSkyDome()

    // Assert
    const getHeight = (vertex: number) => dome.positions[vertex * 3 + 2] ?? Number.NaN
    expect(getHeight(0)).toBeGreaterThan(getHeight(11))
    expect(getHeight(11)).toBeGreaterThan(getHeight(22))
    expect(getHeight(22)).toBeCloseTo(0, 4)
    expect(dome.positions[22 * 3]).toBeCloseTo(100, 4)
  })

  it('joins consecutive rings with two triangles per segment and wraps the last segment', () => {
    // Arrange
    // Act
    const dome = createSkyDome()

    // Assert
    expect(dome.triangleCorners).toHaveLength(2 * 11 * 2 * 3)
    expect([...dome.triangleCorners.subarray(0, 6)]).toEqual([0, 12, 11, 0, 1, 12])
    expect([...dome.triangleCorners.subarray(60, 66)]).toEqual([10, 11, 21, 10, 0, 11])
  })

  it('uses the segment count it is given', () => {
    // Arrange
    // Act
    const dome = createSkyDome({ radius: 50, segmentCount: 8 })

    // Assert
    expect(dome.segmentCount).toBe(8)
    expect(dome.vertexCount).toBe(dome.ringCount * 8)
  })
})
