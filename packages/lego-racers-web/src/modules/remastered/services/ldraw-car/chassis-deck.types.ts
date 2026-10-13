import type { BrickFootprint } from '@lego-games/lego-racers/car-builder'
import type { GridOffset } from './chassis-grid-offset.types.ts'

// The base of an upright stud of a chassis recipe, where the bottom of a brick on it rests: recipe LDraw axes and units (y down).
export type StudBase = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// How a chassis recipe's studs hold the game's grid: the shift of every built brick (LDU, recipe axes), the chassis footprint with
// each cell over a stud attachable at that stud's height and the others not (`studFootprint`), and the same with the cells off every
// stud on the recipe's main deck (`deckFootprint`), for a brick that rests on no stud. The game counts heights in whole plates; a stud
// off that step (a base with a raised middle, a part set between plates) lifts its cell by the rest (`cellLifts`, plates, by cell index).
export type ChassisDeck = {
  readonly gridOffset: GridOffset
  readonly studFootprint: BrickFootprint
  readonly deckFootprint: BrickFootprint
  readonly cellLifts: readonly number[]
}
