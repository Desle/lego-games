import type { BrickFootprint, PlacedBrick } from '../../types/car-builder.types.ts'
import {
  createBuildGrid,
  getFootprintCell,
  getGridWithBrick,
  getOrientedSize,
  getOverlapCount,
  getPlacement,
  getRestingHeight,
} from './build-grid.ts'

// A 2 by 1 plate: a top of height 1 with a stud (0x80), a connector (0x80) at the bottom, 0 high at the bottom.
const PLATE: BrickFootprint = Object.freeze({
  width: 2,
  height: 1,
  cells: Uint8Array.from([0x81, 0x80, 0x81, 0x80]),
  originVertexIndex: 0xffff,
})
// An L shape 2 by 2 with distinct cells so a turn is visible: heights 1, 2, 3, 4 in x-major order.
const SHAPE: BrickFootprint = Object.freeze({
  width: 2,
  height: 2,
  cells: Uint8Array.from([1, 0, 2, 0, 3, 0, 4, 0]),
  originVertexIndex: 0,
})

const getBrick = (x: number, y: number, baseHeight: number): PlacedBrick => ({
  piece: {
    name: 'plate',
    id: 0x800,
    footprint: PLATE,
    faceRecordCount: 0,
    geometryOffset: 0,
    variantIndex: 0,
    variantCount: 1,
  },
  x,
  y,
  orientation: 0,
  colorIndex: 0,
  unidentifiedValue: 0,
  baseHeight,
})

describe('getFootprintCell', () => {
  it.each([
    [0, [1, 2, 3, 4]],
    [1, [3, 1, 4, 2]],
    [2, [4, 3, 2, 1]],
    [3, [2, 4, 1, 3]],
  ])('reads the cells of a shape turned %i quarter-turns (0x0049ea60)', (orientation, expected) => {
    // Arrange
    const cells = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ] as const

    // Act
    const tops = cells.map(([x, y]) => getFootprintCell(SHAPE, x, y, orientation).top)

    // Assert
    expect(tops).toEqual(expected)
  })
})

describe('getOrientedSize', () => {
  it('swaps the extent on a quarter turn', () => {
    // Arrange / Act / Assert
    expect(getOrientedSize(PLATE, 0)).toEqual({ width: 2, height: 1 })
    expect(getOrientedSize(PLATE, 1)).toEqual({ width: 1, height: 2 })
    expect(getOrientedSize(PLATE, 3)).toEqual({ width: 1, height: 2 })
  })
})

describe('getRestingHeight', () => {
  it('finds nothing to rest on over an empty grid, unless it may stand on the floor', () => {
    // Arrange
    const grid = createBuildGrid()

    // Act / Assert
    expect(getRestingHeight(grid, PLATE, 0, 0, 0, false)).toBe(-1)
    expect(getRestingHeight(grid, PLATE, 0, 0, 0, true)).toBe(0)
  })

  it('refuses a position outside the grid with the codes -2, -3 and -4', () => {
    // Arrange
    const grid = createBuildGrid()

    // Act / Assert
    expect(getRestingHeight(grid, PLATE, -1, 0, 0, true)).toBe(-2)
    expect(getRestingHeight(grid, PLATE, 9, 0, 0, true)).toBe(-3)
    expect(getRestingHeight(grid, PLATE, 0, 6, 0, true)).toBe(-4)
  })

  it('rests on the top of a brick below, at that top', () => {
    // Arrange
    const grid = getGridWithBrick(createBuildGrid(), getBrick(2, 2, 0), 0)

    // Act
    const height = getRestingHeight(grid, PLATE, 2, 2, 0, false)

    // Assert
    expect(height).toBe(1)
  })
})

describe('getPlacement', () => {
  it('counts the cells a brick would collide with at a height inside what is there', () => {
    // Arrange
    const grid = getGridWithBrick(createBuildGrid(), getBrick(2, 2, 0), 0)

    // Act / Assert
    expect(getOverlapCount(grid, PLATE, 2, 2, 0, 0)).toBe(2)
    expect(getOverlapCount(grid, PLATE, 2, 2, 0, 1)).toBe(0)
    expect(getOverlapCount(grid, PLATE, 2, 2, 0, -1)).toBe(3)
  })

  it('stacks a brick on top of another', () => {
    // Arrange
    const grid = getGridWithBrick(createBuildGrid(), getBrick(2, 2, 0), 0)

    // Act
    const placement = getPlacement(grid, PLATE, 3, 2, 0, false)

    // Assert
    expect(placement).toEqual({ isPlaceable: true, baseHeight: 1 })
  })
})
