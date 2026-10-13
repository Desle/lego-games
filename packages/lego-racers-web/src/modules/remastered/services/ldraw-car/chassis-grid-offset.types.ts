export type GridOffset = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// The box of a chassis recipe's base, studs included, in the recipe's LDraw axes and units (y down, so the top is the least y).
export type BaseBounds = {
  readonly minimumX: number
  readonly maximumX: number
  readonly minimumY: number
  readonly minimumZ: number
  readonly maximumZ: number
}

// The edges of a row of studs along one axis, in LDraw units.
export type StudSpan = {
  readonly minimum: number
  readonly maximum: number
}

// How a chassis recipe's base holds the game's grid: the shift of every built brick (LDU) and the share of the chassis's building cells
// that sit on a stud of the base's deck.
export type ChassisFit = {
  readonly gridOffset: GridOffset
  readonly footprintCoverage: number
}
