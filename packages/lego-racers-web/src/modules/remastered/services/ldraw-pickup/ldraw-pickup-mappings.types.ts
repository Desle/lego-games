// How an effect's model of the original is drawn as one LDraw part. `matrix` takes the part's points (LDraw axes and units) into the
// model's frame (the original's units, the model's scale applied): the rows of a 3 x 3 matrix, then the translation.
export type LDrawPickupMapping = {
  readonly partNumber: string
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
  // The LDraw colour of each look of the model (the kind of a power-up brick); `defaultColorCode` when the look has none.
  readonly colorCodes: Readonly<Record<string, number>>
  readonly defaultColorCode: number
}
