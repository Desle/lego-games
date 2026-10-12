// A race, the original's frames to record and the texture whose triangles must all find their partner in the port.
export type EffectTraceCase = {
  readonly name: string
  readonly race: string
  readonly frames: readonly number[]
  readonly texture: RegExp
}

export type EffectFrameResult = {
  readonly frame: number
  readonly originalCount: number
  // The original's triangles of the texture with no partner, not counting those on the viewport's edge (the original's
  // driver clips them there).
  readonly unmatchedCount: number
  readonly coordinateMismatchCount: number
}
