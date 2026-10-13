import {
  createBuildGrid,
  getGridWithBrick,
  getRestingHeight,
} from '@lego-games/lego-racers/car-builder'
import type { BrickFootprint, CarDesign, PlacedBrick } from '@lego-games/lego-racers/car-builder'
import { getDominantDeckPlates } from './chassis-grid-offset.ts'

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

// The design built again on a flat deck: the chassis's attachable tops all at the height most of them have, and every brick dropped
// in the order it was placed onto what is under it (0x0049e2d0's resting height), so a brick the game set on a raised or sunken cell
// of its chassis sits on the real base's deck, with what was built on it. A brick that rests on nothing keeps its height.
export const getDeckRestedDesign = (design: CarDesign): CarDesign => {
  const chassis = design.bricks.find((brick) => brick.piece.id < FIRST_BUILDER_BRICK_ID)
  if (chassis === undefined) return design
  const flatChassis: PlacedBrick = Object.freeze({
    ...chassis,
    piece: Object.freeze({
      ...chassis.piece,
      footprint: getFlatDeckFootprint(
        chassis.piece.footprint,
        getDominantDeckPlates(chassis.piece.footprint)
      ),
    }),
  })
  const rested = design.bricks.reduce(
    (built, brick, index) => {
      const restingHeight =
        brick === chassis
          ? brick.baseHeight
          : getRestingHeight(
              built.grid,
              brick.piece.footprint,
              brick.x,
              brick.y,
              brick.orientation,
              false
            )
      const placed =
        restingHeight < 0 || restingHeight === brick.baseHeight
          ? brick
          : Object.freeze({ ...brick, baseHeight: restingHeight })
      return {
        bricks: [...built.bricks, placed],
        grid: getGridWithBrick(built.grid, placed === chassis ? flatChassis : placed, index),
      }
    },
    { bricks: [] as readonly PlacedBrick[], grid: createBuildGrid() }
  )
  return Object.freeze({ bricks: Object.freeze(rested.bricks), grid: rested.grid })
}
