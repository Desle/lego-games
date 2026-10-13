// What two silhouettes of one view say: how much they overlap, and how far the LDraw one's centre of area lies from the original's
// (pixels, x to the right and y up the picture).
export type SilhouetteComparison = {
  readonly intersectionOverUnion: number
  readonly centroidOffset: readonly [number, number]
  readonly originalArea: number
  readonly replacementArea: number
}

// The measurements of one item that make its score: LDraw units for distances, ratios for sizes, CIE76 ΔE for colours.
export type FidelityMeasurement = {
  readonly meanIntersectionOverUnion: number
  readonly centroidDistance: number
  readonly scaleRatio: number
  // Null when no pixel is covered by both drawings.
  readonly meanColorDifference: number | null
  // Null when the item has no attachment points.
  readonly meanAnchorDistance: number | null
}

// How a measurement fills its part of the score: full at `full`, empty at `empty`, worth `weight` of 100.
export type ScorePart = {
  readonly full: number
  readonly empty: number
  readonly weight: number
}

// What a chassis recipe is judged on (its real base is not the game's chassis brick, so not its silhouette or colour): how far the
// game's wheels' hubs are from the base (null without wheels), how far the built bricks move to sit on its studs (LDU), and the share of
// the chassis's building cells over a stud of its deck.
export type ChassisMeasurement = {
  readonly meanWheelHubDistance: number | null
  readonly gridDistance: number
  readonly footprintCoverage: number
}
