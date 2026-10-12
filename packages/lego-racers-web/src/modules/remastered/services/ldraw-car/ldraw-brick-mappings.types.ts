// How a game brick is built from an LDraw part. A point `q` of the part (LDraw axes, in LDraw units) is first turned into the
// game's axes (x, z, -y), mirrored across x when `isMirrored`, turned `quarterTurns` quarter turns about the vertical axis and
// moved by `offset`: that is the point in the brick's own frame, whose origin is the footprint's corner at the brick's base.
export type LDrawBrickMapping = {
  readonly partNumber: string
  readonly quarterTurns: number
  readonly isMirrored: boolean
  readonly offset: readonly [number, number, number]
  // The mean difference, in plates, between the game brick's top surface and the part's (studs left out) over the footprint.
  readonly heightError: number
}

// An LDraw colour code for each colour of `L_COLORS.LEB` and the sRGB colour the library gives it.
export type LDrawBrickColor = {
  readonly code: number
  readonly hex: number
}

// One LDraw part of a composite brick (a base brick with an accessory moulded on). `matrix` is the part's points (LDraw axes and
// units) into the brick's frame (game axes, LDraw units): the rows of a 3 x 3 matrix, then the translation. `colorCode` is the
// LDraw colour of the part, or null for the colour of the brick the player placed.
export type LDrawCompositePart = {
  readonly partNumber: string
  readonly colorCode: number | null
  readonly matrix: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
}

export type LDrawCompositeMapping = {
  readonly parts: readonly LDrawCompositePart[]
}
