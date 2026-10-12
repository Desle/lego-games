// A ray straight down through the body at (x, y): the heights, in studs, where it enters and leaves the body, pairs of them.
export type BodyRay = {
  readonly x: number
  readonly y: number
  readonly intervals: readonly number[]
}

// Where a ray meets a triangle: the height and the sign of the triangle's winding seen from above.
export type BodyHit = {
  readonly height: number
  readonly turn: number
}
