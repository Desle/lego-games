import { createBuildGrid } from '@lego-games/lego-racers/car-builder'
import type { BrickPiece, CarDesign, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import { getDeckRestedDesign } from './deck-rested-design.ts'

const ATTACHABLE = 0x80
const CONNECTOR = 0x80

const createPiece = (id: number, width: number, height: number, cells: number[]): BrickPiece =>
  Object.freeze({
    name: `piece${String(id)}`,
    id,
    footprint: Object.freeze({
      width,
      height,
      cells: Uint8Array.from(cells),
      originVertexIndex: 0,
    }),
    faceRecordCount: 0,
    geometryOffset: 0,
    variantIndex: 0,
    variantCount: 1,
  })

// A 10 x 6 chassis whose decks are 3 plates high, but for a raised cell at (0, 0) 5 plates high.
const chassisPiece = createPiece(
  11,
  10,
  6,
  Array.from({ length: 60 }, (_, index) => [ATTACHABLE | (index === 0 ? 5 : 3), 0]).flat()
)
const brickPiece = createPiece(0x800, 1, 1, [ATTACHABLE | 3, CONNECTOR])

const place = (piece: BrickPiece, x: number, baseHeight: number): PlacedBrick =>
  Object.freeze({ piece, x, y: 0, orientation: 0, colorIndex: 0, unidentifiedValue: 0, baseHeight })

const createDesign = (bricks: readonly PlacedBrick[]): CarDesign =>
  Object.freeze({ bricks, grid: createBuildGrid() })

describe('getDeckRestedDesign', () => {
  it('drops a brick on a raised cell of the chassis, and the brick on it, onto the deck', () => {
    // Arrange
    const design = createDesign([
      place(chassisPiece, 0, 0),
      place(brickPiece, 0, 5),
      place(brickPiece, 0, 8),
      place(brickPiece, 1, 3),
    ])

    // Act
    const rested = getDeckRestedDesign(design)

    // Assert
    expect(rested.bricks.map((brick) => brick.baseHeight)).toEqual([0, 3, 6, 3])
  })

  it('leaves a design that already rests on the deck as it is', () => {
    // Arrange
    const bricks = [place(chassisPiece, 0, 0), place(brickPiece, 1, 3), place(brickPiece, 1, 6)]

    // Act
    const rested = getDeckRestedDesign(createDesign(bricks))

    // Assert
    expect(rested.bricks).toEqual(bricks)
  })
})
