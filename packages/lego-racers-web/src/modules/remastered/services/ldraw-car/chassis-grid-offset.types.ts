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
