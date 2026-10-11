import type { BrickPiece } from '../../types/car-builder.types.ts'
import {
  createBuilderCursor,
  getBuilderCursorAtBrick,
  moveBuilderCursor,
  rotateBuilderCursor,
} from './builder-cursor.ts'

const getPiece = (width: number, height: number): BrickPiece => ({
  name: `p${String(width)}x${String(height)}`,
  id: 0x800 + width * 16 + height,
  footprint: {
    width,
    height,
    cells: new Uint8Array(width * height * 2),
    originVertexIndex: 0xffff,
  },
  faceRecordCount: 1,
  geometryOffset: 0,
  variantIndex: 0,
  variantCount: 1,
})

describe('builder cursor (0x00499890 and the moves around it)', () => {
  it('starts in the middle of the grid', () => {
    // Arrange / Act
    const cursor = createBuilderCursor(null, getPiece(2, 2), 3, 11)

    // Assert
    expect(cursor).toMatchObject({ x: 4, y: 2, orientation: 0, pivotCorner: 0 })
  })

  it('starts a brick wider than the grid is deep turned a quarter', () => {
    // Arrange / Act
    const cursor = createBuilderCursor(null, getPiece(2, 8), 0, 11)

    // Assert
    expect(cursor).toMatchObject({ orientation: 1, x: 1, y: 2 })
  })

  it('steps until the grid edge and no further', () => {
    // Arrange
    const cursor = createBuilderCursor(null, getPiece(2, 2), 0, 11)

    // Act
    const farRight = moveBuilderCursor(cursor, 10, 0, false)
    const blocked = moveBuilderCursor(farRight.cursor, 1, 0, false)

    // Assert
    expect(farRight.cursor.x).toBe(8)
    expect(blocked.isMoved).toBe(false)
  })

  it('refuses a diagonal step when one of its two steps is blocked and undoes the first (0x004773e0)', () => {
    // Arrange
    const against = moveBuilderCursor(
      createBuilderCursor(null, getPiece(2, 2), 0, 11),
      10,
      0,
      false
    ).cursor

    // Act
    const atomic = moveBuilderCursor(against, 1, 1, true)
    const separate = moveBuilderCursor(against, 1, 1, false)

    // Assert
    expect(atomic.isMoved).toBe(false)
    expect(separate.isMoved).toBe(true)
    expect(separate.cursor.y).toBe(against.y + 1)
  })

  it('turns a quarter, keeping the corner it holds and staying inside the grid', () => {
    // Arrange
    const cursor = moveBuilderCursor(
      createBuilderCursor(null, getPiece(4, 1), 0, 11),
      10,
      0,
      false
    ).cursor

    // Act
    const turned = rotateBuilderCursor(cursor)

    // Assert
    expect(turned.orientation).toBe(1)
    expect(turned.x + 1).toBeLessThanOrEqual(10)
    expect(turned.y + 4).toBeLessThanOrEqual(6)
  })

  it('turns a half when a quarter turn would leave the grid (0x00499b00)', () => {
    // Arrange
    const cursor = createBuilderCursor(null, getPiece(10, 6), 0, 0)

    // Act
    const turned = rotateBuilderCursor(cursor)

    // Assert
    expect(turned.orientation).toBe(2)
  })

  it('goes to the pivot corner of the quarter of the grid it is in', () => {
    // Arrange
    const cursor = createBuilderCursor(null, getPiece(2, 2), 0, 11)

    // Act
    const farCorner = moveBuilderCursor(cursor, 10, 10, false).cursor

    // Assert
    expect(farCorner.pivotCorner).toBe(3)
    expect(farCorner.anchorX).toBe(10)
    expect(farCorner.anchorY).toBe(6)
  })

  it('puts a brick taken off the car back where it was', () => {
    // Arrange / Act
    const cursor = getBuilderCursorAtBrick(getPiece(2, 3), 5, 12, 3, 1, 1)

    // Assert
    expect(cursor).toMatchObject({ x: 3, y: 1, orientation: 1, colorIndex: 5, setId: 12 })
  })
})
