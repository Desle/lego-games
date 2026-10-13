// The centre of a stud on a chassis recipe's deck, in the recipe's LDraw axes and units (the stud stands along -y).
export type DeckStud = {
  readonly x: number
  readonly z: number
}

// The box of the points of one group of a deck's highest points, LDraw units.
export type PointGroupBox = {
  readonly minimumX: number
  readonly maximumX: number
  readonly minimumZ: number
  readonly maximumZ: number
}
