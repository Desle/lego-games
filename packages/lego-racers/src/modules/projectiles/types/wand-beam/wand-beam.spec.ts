import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { getRaySphereHit, getWandBeam } from './wand-beam.ts'
import type { WandBeamRequest } from './wand-beam.types.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const f = Math.fround
const NO_HIT = (): null => null

const getRequest = (overrides: Partial<WandBeamRequest> = {}): WandBeamRequest => ({
  muzzlePosition: { x: 0, y: 0, z: 0 },
  muzzleDirection: { x: 1, y: 0, z: 0 },
  isStarting: false,
  isEnding: false,
  timerMilliseconds: 7000,
  struck: null,
  ...overrides,
})

describe('getWandBeam (0x00455100)', () => {
  it('starts 3 above the muzzle and reaches four segments of 50 units while active', () => {
    // Arrange / Act
    const beam = getWandBeam(SINGLE, NO_HIT, getRequest())

    // Assert
    expect(beam.origin).toEqual({ x: 0, y: 0, z: 3 })
    expect(beam.length).toBe(50)
    expect(beam.points.map((point) => point.x)).toEqual([50, 100, 150, 200])
  })

  it('grows in over the 500 ms start and fades out over the 500 ms end', () => {
    // Arrange / Act
    const starting = getWandBeam(
      SINGLE,
      NO_HIT,
      getRequest({ isStarting: true, timerMilliseconds: 250 })
    )
    const ending = getWandBeam(
      SINGLE,
      NO_HIT,
      getRequest({ isEnding: true, timerMilliseconds: 100 })
    )

    // Assert: (1 - 250 * 0.002) * 50 and 100 * 0.002 * 50, each rounded to a float like the original's stores.
    expect(starting.length).toBe(f(f(1 - f(250 * f(0.002))) * 50))
    expect(ending.length).toBe(f(f(100 * f(0.002)) * 50))
  })

  it('shares the distance to a wall over the four segments', () => {
    // Arrange
    const wall = () => ({ point: { x: 40, y: 0, z: 3 }, normal: { x: -1, y: 0, z: 0 } })

    // Act
    const beam = getWandBeam(SINGLE, wall, getRequest())

    // Assert
    expect(beam.length).toBe(10)
    expect(beam.points.map((point) => point.x)).toEqual([10, 20, 30, 40])
  })

  it('bends towards the struck racer and stops one radius short of it', () => {
    // Arrange: the racer is 3 up and 60 along y, radius 10.
    const request = getRequest({ struck: { center: { x: 0, y: 60, z: 3 }, radius: 10 } })

    // Act
    const beam = getWandBeam(SINGLE, NO_HIT, request)

    // Assert: (60 - 10) / 4 = 12.5 per segment along +y.
    expect(beam.length).toBe(12.5)
    expect(beam.points.map((point) => point.y)).toEqual([12.5, 25, 37.5, 50])
  })
})

describe('getRaySphereHit (0x0043fdc0)', () => {
  const sphere = { center: { x: 10, y: 0, z: 0 }, radius: 2 }

  it('hits a sphere on the segment', () => {
    // Arrange / Act
    const hit = getRaySphereHit(SINGLE, { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, sphere)

    // Assert
    expect(hit?.x).toBe(8)
  })

  it('misses a sphere the segment stops short of', () => {
    // Arrange / Act
    const hit = getRaySphereHit(SINGLE, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, sphere)

    // Assert
    expect(hit).toBeNull()
  })

  it('misses a sphere beside the line', () => {
    // Arrange / Act
    const hit = getRaySphereHit(SINGLE, { x: 0, y: 5, z: 0 }, { x: 20, y: 5, z: 0 }, sphere)

    // Assert
    expect(hit).toBeNull()
  })

  it('writes the direction y into the z of the point, as the original does (0x0043fee1)', () => {
    // Arrange: the line climbs, so the direction's y and z differ.
    const from = { x: 0, y: 0, z: 0 }
    const to = { x: 20, y: 0, z: 4 }

    // Act
    const hit = getRaySphereHit(SINGLE, from, to, { center: { x: 10, y: 0, z: 2 }, radius: 2 })

    // Assert
    expect(hit?.z).toBe(0)
  })
})
