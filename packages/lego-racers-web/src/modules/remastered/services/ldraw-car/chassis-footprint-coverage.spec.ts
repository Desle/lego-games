import type { BrickFootprint } from '@lego-games/lego-racers/car-builder'
import { getDeckStuds, getFootprintCoverage } from './chassis-footprint-coverage.ts'

const STUD_RADIUS = 6
const RING_POINTS = 16

// The top ring of a stud at (x, z) with its top at `top` (LDraw y, up is less), as x, y, z in turn.
const getStudRing = (x: number, z: number, top: number): readonly number[] =>
  Array.from({ length: RING_POINTS }, (_unused, index) => {
    const angle = (index / RING_POINTS) * 2 * Math.PI
    return [x + STUD_RADIUS * Math.cos(angle), top, z + STUD_RADIUS * Math.sin(angle)]
  }).flat()

// A footprint of `width` x `height` cells, every one attachable.
const createFootprint = (width: number, height: number): BrickFootprint =>
  Object.freeze({
    width,
    height,
    cells: Uint8Array.from(Array.from({ length: width * height }, () => [0x83, 0]).flat()),
    originVertexIndex: 0,
  })

describe('getDeckStuds', () => {
  it('finds one stud per ring on the highest level and ignores lower ones', () => {
    // Arrange
    const positions = [
      ...getStudRing(10, 10, -20),
      ...getStudRing(30, 10, -20),
      ...getStudRing(50, 10, -12),
    ]

    // Act
    const studs = getDeckStuds(positions)

    // Assert
    expect(studs).toEqual([
      { x: 10, z: 10 },
      { x: 30, z: 10 },
    ])
  })

  it('takes a flat top for no stud', () => {
    // Arrange
    const positions = [0, -8, 0, 40, -8, 0, 40, -8, 40, 0, -8, 40]

    // Act
    const studs = getDeckStuds(positions)

    // Assert
    expect(studs).toEqual([])
  })
})

describe('getFootprintCoverage', () => {
  it('gives the share of building cells over a stud of the deck', () => {
    // Arrange
    const footprint = createFootprint(2, 2)
    const studs = [
      { x: 10, z: 10 },
      { x: 30, z: 10 },
      { x: 30, z: 30 },
    ]

    // Act
    const coverage = getFootprintCoverage(footprint, { x: 0, y: 0, z: 0 }, studs)

    // Assert
    expect(coverage).toBe(0.75)
  })

  it('follows the grid offset', () => {
    // Arrange
    const footprint = createFootprint(1, 1)
    const studs = [{ x: 30, z: 10 }]

    // Act
    const shifted = getFootprintCoverage(footprint, { x: 20, y: 0, z: 0 }, studs)
    const halfOff = getFootprintCoverage(footprint, { x: 10, y: 0, z: 0 }, studs)

    // Assert
    expect(shifted).toBe(1)
    expect(halfOff).toBe(0)
  })
})
