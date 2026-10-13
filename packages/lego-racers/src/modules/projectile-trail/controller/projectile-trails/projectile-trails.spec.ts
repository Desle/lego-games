import type { TrailParameters, TrailPool } from '../../types/projectile-trail.types.ts'
import {
  createTrailPool,
  getBallTrailRing,
  getTrailDrawings,
  pushTrailRing,
  releaseTrail,
  stepTrailPool,
  takeTrail,
  TRAIL_COUNT,
} from './projectile-trails.ts'

// The cannon's block (0x00451f50): 300 ms, 4 rings of 4 points, fade 0.1, colour 0x004c1c4c.
const CANNON: TrailParameters = {
  durationMilliseconds: 300,
  ringSize: 4,
  verticesPerRing: 4,
  fadeFactor: Math.fround(0.1),
  alphaReduction: 0,
  color: { red: 50, green: 50, blue: 50, alpha: 200 },
  materialName: 'canstrk',
}

const ORIGIN = { x: 0, y: 0, z: 0 }

const getPushed = (pool: TrailPool, index: number, x: number, milliseconds: number): TrailPool => {
  const ring = getBallTrailRing({ x, y: 0, z: 10 }, { x: 0, y: 5, z: 0 }, 3)
  if (ring === null) throw new Error('The ring was expected')
  return pushTrailRing(pool, index, milliseconds, ring)
}

describe('getBallTrailRing', () => {
  it('lays four points round the ball across the horizontal perpendicular of its velocity', () => {
    // Arrange
    const position = { x: 10, y: 20, z: 30 }
    const velocity = { x: 0, y: 5, z: 2 }

    // Act
    const ring = getBallTrailRing(position, velocity, 3)

    // Assert
    expect(ring?.vertices).toEqual([
      { x: 8.5, y: 20, z: 31.5 },
      { x: 8.5, y: 20, z: 28.5 },
      { x: 11.5, y: 20, z: 28.5 },
      { x: 11.5, y: 20, z: 31.5 },
    ])
    expect(ring?.center).toBe(position)
  })

  it('leaves out a velocity without a horizontal part', () => {
    // Arrange
    const velocity = { x: 0, y: 0, z: 9 }

    // Act
    const ring = getBallTrailRing(ORIGIN, velocity, 3)

    // Assert
    expect(ring).toBeNull()
  })
})

describe('the trail pool', () => {
  it('hands out the first free trail and none once all six are in use (0x004939b0)', () => {
    // Arrange
    let pool = createTrailPool()

    // Act
    const indices = Array.from({ length: TRAIL_COUNT + 1 }, () => {
      const taken = takeTrail(pool, CANNON)
      pool = taken.pool
      return taken.index
    })

    // Assert
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, null])
  })

  it('draws nothing until the second ring: the first only fills a slot (0x00492f10)', () => {
    // Arrange
    const taken = takeTrail(createTrailPool(), CANNON)

    // Act
    const first = getPushed(taken.pool, 0, 0, 16)
    const second = getPushed(first, 0, 1, 16)

    // Assert
    expect(getTrailDrawings(first)).toEqual([])
    expect(getTrailDrawings(second)).toHaveLength(1)
  })

  it('builds rings of four points joined by two triangles a pair and closed at the end (0x004931a0)', () => {
    // Arrange
    const taken = takeTrail(createTrailPool(), CANNON)
    const pushed = [1, 2, 3].reduce(
      (pool, x) => getPushed(pool, 0, x, 20),
      getPushed(taken.pool, 0, 0, 20)
    )

    // Act
    const mesh = getTrailDrawings(pushed)[0]?.mesh

    // Assert
    expect(mesh?.vertices.length).toBeGreaterThan(4)
    expect(mesh?.triangles.length).toBeGreaterThan(8)
    expect(mesh?.vertices[0]?.u).toBe(0)
    expect(mesh?.vertices[1]?.u).toBeCloseTo(0.2, 6)
  })

  it('frees a released trail once its rings have aged out (0x00492c30)', () => {
    // Arrange
    const taken = takeTrail(createTrailPool(), CANNON)
    const pushed = [1, 2, 3, 4, 5, 6].reduce(
      (pool, x) => getPushed(pool, 0, x, 60),
      getPushed(taken.pool, 0, 0, 60)
    )
    const released = releaseTrail(pushed, 0)

    // Act
    const stepped = Array.from({ length: 40 }, () => 16).reduce(
      (pool, milliseconds) => stepTrailPool(pool, milliseconds),
      released
    )

    // Assert
    expect(pushed.trails[0]?.isActive).toBe(true)
    expect(stepped.trails[0]?.isActive).toBe(false)
    expect(takeTrail(stepped, CANNON).index).toBe(0)
  })

  it('does not age a trail that is not released', () => {
    // Arrange
    const taken = takeTrail(createTrailPool(), CANNON)
    const pushed = getPushed(getPushed(taken.pool, 0, 0, 16), 0, 1, 16)

    // Act
    const stepped = stepTrailPool(pushed, 1000)

    // Assert
    expect(stepped.trails[0]).toBe(pushed.trails[0])
  })
})
