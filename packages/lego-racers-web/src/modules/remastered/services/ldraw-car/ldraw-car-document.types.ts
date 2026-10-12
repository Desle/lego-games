import type { PlacedBrick } from '@lego-games/lego-racers/car-builder'

// A car as an LDraw model: one line per brick that has an LDraw part, in LDraw axes and units, and the bricks that have none.
export type LDrawCarDocument = {
  readonly text: string
  readonly partNumbers: readonly string[]
  readonly unmappedBricks: readonly PlacedBrick[]
}

// Where the car's origin lies, in studs, as the car builder's mesh puts it (the offset added to every vertex).
export type CarOrigin = {
  readonly x: number
  readonly y: number
  readonly z: number
}
