export type ReplayExpectation = {
  readonly comparedFrameCount: number
  readonly firstDivergence: { readonly frame: number; readonly field: string } | null
}

export type StoredReplay = {
  readonly name: string
  readonly text: string
  readonly expectation: ReplayExpectation
}
