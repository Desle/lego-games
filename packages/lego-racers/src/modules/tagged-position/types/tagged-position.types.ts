export type Vector3 = readonly [number, number, number]

// One 0x14-byte entry at race +0x2804 (filled by 0x0045c380, which also sets flags 3 at +0x10).
export type TaggedPosition = {
  readonly position: Vector3
  readonly identifier: number
}

export type TaggedPositionList = {
  readonly taggedPositions: readonly TaggedPosition[]
  readonly readByteCount: number
}
