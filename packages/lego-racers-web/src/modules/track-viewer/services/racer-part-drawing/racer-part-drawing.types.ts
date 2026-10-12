// What names a racer's part to a viewer extension besides its model: see RacerPartDrawingRequest.
export type RacerPartIdentity = {
  readonly modelName: string | null
  readonly partBytes: readonly number[] | null
}
