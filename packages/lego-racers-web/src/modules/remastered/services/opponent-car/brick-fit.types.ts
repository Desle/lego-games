// A brick the fit placed, in grid cells; the colour is -1 when no surface of the body lies in its cells.
export type FittedBrick = {
  readonly pieceName: string
  readonly orientation: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly colorIndex: number
}

export type FittedBricks = {
  readonly bricks: readonly FittedBrick[]
  // The sum of what the placements gained: filled cells covered, empty ones lost, the cost of the bricks taken off.
  readonly totalGain: number
}
