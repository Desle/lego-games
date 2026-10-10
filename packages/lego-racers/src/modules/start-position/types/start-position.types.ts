export type Vector3 = readonly [number, number, number]

// One `0x27 slot { ... }` block; the loader writes only the vectors the block names.
export type StartPosition = {
  // Not range-checked by the original: it indexes the racer set's three arrays of six vectors.
  readonly slot: number
  readonly position: Vector3 | null
  readonly firstAxis: Vector3 | null
  readonly secondAxis: Vector3 | null
}

export type StartPositionList = {
  readonly startPositions: readonly StartPosition[]
  readonly readByteCount: number
}
