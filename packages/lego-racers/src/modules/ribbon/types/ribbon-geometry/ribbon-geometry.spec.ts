import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { LIGHTNING_RIBBON_SHAPE, TETHER_RIBBON_SHAPE } from '../ribbon-shapes/ribbon-shapes.ts'
import type { RibbonRequest, RibbonSegment } from '../ribbon.types.ts'
import { getRibbonCorners, getRibbonSkin } from './ribbon-geometry.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }
const ALONG_X: Vector3 = { x: 1, y: 0, z: 0 }
const CORNERS_PER_CELL = 6

const getStraightSegments = (count: number, length: number, bulge: number): RibbonSegment[] =>
  Array.from({ length: count }, (_, index) => ({
    end: { x: length * (index + 1), y: 0, z: 0 },
    bulge,
    jitter: null,
  }))

const getStraightRequest = (bulge: number): RibbonRequest => ({
  begin: ORIGIN,
  direction: ALONG_X,
  initialJitter: null,
  segments: getStraightSegments(5, 5, bulge),
})

describe('getRibbonSkin (0x00494870)', () => {
  it('lays five rings on each segment and repeats a ring at the wrap of the texture (0x00494870)', () => {
    // Arrange / Act
    const skin = getRibbonSkin(SINGLE, TETHER_RIBBON_SHAPE, getStraightRequest(0))

    // Assert: the first ring is v 0, the counter runs 1, 2, 3 and a ring is repeated at v 0 when it passes 3, except after
    // the last ring of a segment.
    expect(skin.rings.slice(0, 8).map((ring) => ring.v)).toEqual([0, 1, 2, 3, 0, 1, 2, 3])
    expect(skin.bones).toHaveLength(5)
    expect(skin.pairs).toHaveLength(25)
  })

  it('skips a segment shorter than the square root of 0.02 (0x00494870)', () => {
    // Arrange
    const request: RibbonRequest = {
      ...getStraightRequest(0),
      segments: [{ end: { x: 0.1, y: 0, z: 0 }, bulge: 0, jitter: null }],
    }

    // Act
    const skin = getRibbonSkin(SINGLE, TETHER_RIBBON_SHAPE, request)

    // Assert
    expect(skin.bones).toHaveLength(0)
    expect(getRibbonCorners(SINGLE, skin, null)).toEqual([])
  })
})

describe('getRibbonCorners', () => {
  it('puts the ring round the segment: width to the second axis, the middle vertex raised (0x00444340)', () => {
    // Arrange
    const skin = getRibbonSkin(SINGLE, TETHER_RIBBON_SHAPE, getStraightRequest(0))

    // Act
    const corners = getRibbonCorners(SINGLE, skin, null)

    // Assert: the first cell joins the first ring after the start (a fifth of the segment on) to the start ring.
    const [previousFirst, currentSecond, currentFirst] = corners
    expect(previousFirst?.position).toEqual({ x: 0, y: Math.fround(0.6), z: 0 })
    expect(currentFirst?.position.x).toBeCloseTo(1, 5)
    expect(currentFirst?.position.y).toBeCloseTo(0.6, 5)
    expect(currentSecond?.position.z).toBeCloseTo(0.3, 5)
    expect(currentFirst?.u).toBe(0)
    expect(currentFirst?.v).toBe(1)
    expect(previousFirst?.v).toBe(0)
  })

  it('makes four triangles to a pair of rings: two cells of two', () => {
    // Arrange
    const skin = getRibbonSkin(SINGLE, TETHER_RIBBON_SHAPE, getStraightRequest(0))

    // Act
    const corners = getRibbonCorners(SINGLE, skin, null)

    // Assert
    expect(corners).toHaveLength(skin.pairs.length * 2 * CORNERS_PER_CELL)
  })

  it('bulges the middle of a segment sideways by twice the bulge times a quarter (a quadratic curve)', () => {
    // Arrange: one segment of 10 with a bulge of 4; the middle ring of the curve at 0.5 would be 2 aside, the rings lie at
    // fifths, so the third ring (0.6) is 2 * 0.6 * 0.4 * 4 = 1.92 aside.
    const request: RibbonRequest = {
      ...getStraightRequest(4),
      segments: [{ end: { x: 10, y: 0, z: 0 }, bulge: 4, jitter: null }],
    }
    const skin = getRibbonSkin(SINGLE, TETHER_RIBBON_SHAPE, request)

    // Act
    const corners = getRibbonCorners(SINGLE, skin, null)

    // Assert: ring 3 of the segment (index 3), its centre vertex (the middle of the three) is raised by half the width.
    const third = skin.pairs.findIndex(([current]) => current === 3)
    const centre = corners[third * 2 * CORNERS_PER_CELL + 1]
    expect(centre?.position.x).toBeCloseTo(6, 4)
    expect(centre?.position.y).toBeCloseTo(1.92, 4)
  })

  it('turns the bones of a ribbon that faces the camera so their third axis points back at it (0x00494ca0)', () => {
    // Arrange: a ribbon along x whose third axis is up.
    const skin = getRibbonSkin(SINGLE, LIGHTNING_RIBBON_SHAPE, getStraightRequest(0))

    // Act
    const facing = getRibbonCorners(SINGLE, skin, { x: 0, y: 1, z: 0 })
    const plain = getRibbonCorners(SINGLE, skin, null)

    // Assert: with the camera looking along +y the ribbon (which runs along x) keeps its first axis and turns its third
    // axis to -y, so the raised middle vertex moves from above to the side.
    const raisedPlain = plain[1]
    const raisedFacing = facing[1]
    expect(raisedPlain?.position.z).toBeGreaterThan(0.4)
    expect(raisedFacing?.position.z).toBeCloseTo(0, 4)
    expect(raisedFacing?.position.y).toBeLessThan(-0.4)
  })

  it('adds the jitter of a ring in the frame of its segment (0x00494290)', () => {
    // Arrange
    const jitter = { x: 0, y: 0, z: 2 }
    const request: RibbonRequest = {
      ...getStraightRequest(0),
      initialJitter: jitter,
    }
    const plain = getRibbonCorners(
      SINGLE,
      getRibbonSkin(SINGLE, TETHER_RIBBON_SHAPE, getStraightRequest(0)),
      null
    )

    // Act
    const jittered = getRibbonCorners(
      SINGLE,
      getRibbonSkin(SINGLE, TETHER_RIBBON_SHAPE, request),
      null
    )

    // Assert: the first ring is the previous ring of the first cell.
    expect(jittered[0]?.position.z).toBeCloseTo((plain[0]?.position.z ?? 0) + 2, 5)
  })
})
