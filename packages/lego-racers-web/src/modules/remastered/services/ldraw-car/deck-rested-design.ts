import {
  createBuildGrid,
  getGridWithBrick,
  getRestingHeight,
} from '@lego-games/lego-racers/car-builder'
import type {
  BrickFootprint,
  BuildGrid,
  CarDesign,
  PlacedBrick,
} from '@lego-games/lego-racers/car-builder'
import { getDominantDeckPlates } from './chassis-grid-offset.ts'
import type { ChassisDeck } from './chassis-deck.types.ts'

// Ids from 0x800 are the builder's own bricks; the lower ones are chassis parts (0x0049c6a0).
const FIRST_BUILDER_BRICK_ID = 0x800
const ATTACHABLE_TOP_FLAG = 0x80
const HEIGHT_MASK = 0x3f

// The chassis's footprint with every attachable top at the deck's height: the flat deck of a real car base.
const getFlatDeckFootprint = (footprint: BrickFootprint, deckPlates: number): BrickFootprint =>
  Object.freeze({
    ...footprint,
    cells: Uint8Array.from(footprint.cells, (value, index) =>
      index % 2 === 0 && (value & ATTACHABLE_TOP_FLAG) !== 0
        ? (value & ~HEIGHT_MASK) | deckPlates
        : value
    ),
  })

const getWithFootprint = (chassis: PlacedBrick, footprint: BrickFootprint): PlacedBrick =>
  Object.freeze({ ...chassis, piece: Object.freeze({ ...chassis.piece, footprint }) })

// The chassis in the grid with each of its cells lifted by the recipe's off-step height there (the recipe is drawn unturned).
const getGridWithChassis = (
  grid: BuildGrid,
  chassis: PlacedBrick,
  index: number,
  cellLifts: readonly number[] | null
): BuildGrid => {
  const withChassis = getGridWithBrick(grid, chassis, index)
  if (cellLifts === null || chassis.orientation !== 0) return withChassis
  const footprintHeight = chassis.piece.footprint.height
  return Object.freeze({
    ...withChassis,
    cells: Object.freeze(
      withChassis.cells.map((cell, cellIndex) => {
        if (cell.brickIndex !== index) return cell
        const column = Math.floor(cellIndex / withChassis.height) - chassis.x
        const row = (cellIndex % withChassis.height) - chassis.y
        const lift = cellLifts[column * footprintHeight + row] ?? 0
        return lift === 0 ? cell : Object.freeze({ ...cell, height: cell.height + lift })
      })
    ),
  })
}

// The design built again on the real base: every brick dropped in the order it was placed onto what is under it (0x0049e2d0's resting
// height). With the recipe's deck, the chassis's cells are the recipe's studs, each at its own height, and a brick over no stud rests
// on the recipe's main deck; without it, every attachable top of the chassis is at the height most of them have (a real base is flat
// where a game chassis has cells at several heights). A brick on a recipe stud off the game's plate step takes a fractional height, so it
// is drawn on that stud. A brick that rests on nothing keeps its height.
export const getDeckRestedDesign = (
  design: CarDesign,
  deck: ChassisDeck | null = null
): CarDesign => {
  const chassis = design.bricks.find((brick) => brick.piece.id < FIRST_BUILDER_BRICK_ID)
  if (chassis === undefined) return design
  const flatFootprint = getFlatDeckFootprint(
    chassis.piece.footprint,
    getDominantDeckPlates(chassis.piece.footprint)
  )
  const studChassis = getWithFootprint(chassis, deck?.studFootprint ?? flatFootprint)
  const deckChassis = getWithFootprint(chassis, deck?.deckFootprint ?? flatFootprint)
  const rested = design.bricks.reduce(
    (built, brick, index) => {
      const getResting = (grid: BuildGrid) =>
        getRestingHeight(grid, brick.piece.footprint, brick.x, brick.y, brick.orientation, false)
      const onStuds = brick === chassis ? brick.baseHeight : getResting(built.studGrid)
      const restingHeight = onStuds < 0 ? getResting(built.deckGrid) : onStuds
      const placed =
        restingHeight < 0 || restingHeight === brick.baseHeight
          ? brick
          : Object.freeze({ ...brick, baseHeight: restingHeight })
      return {
        bricks: [...built.bricks, placed],
        studGrid:
          placed === chassis
            ? getGridWithChassis(built.studGrid, studChassis, index, deck?.cellLifts ?? null)
            : getGridWithBrick(built.studGrid, placed, index),
        deckGrid:
          placed === chassis
            ? getGridWithChassis(built.deckGrid, deckChassis, index, deck?.cellLifts ?? null)
            : getGridWithBrick(built.deckGrid, placed, index),
      }
    },
    {
      bricks: [] as readonly PlacedBrick[],
      studGrid: createBuildGrid(),
      deckGrid: createBuildGrid(),
    }
  )
  return Object.freeze({ bricks: Object.freeze(rested.bricks), grid: rested.studGrid })
}
