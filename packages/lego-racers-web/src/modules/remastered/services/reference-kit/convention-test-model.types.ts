export type ConventionMarker = {
  readonly name: string
  readonly colorCode: number
  readonly part: string
  // Where the part's origin must land in the car's frame, in studs.
  readonly expected: readonly [number, number, number]
}
