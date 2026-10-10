export type BspVolumeVector = readonly [number, number, number]

// One 20-byte node of 0x1001bbb0 / 0x1001bd00 (offsets in that node).
export type BspVolumeNode = {
  // +0x10, +0x12 as int16: node indices, or -1 / -2 (the two markers 0x1001be50 stops at).
  readonly childIndices: readonly [number, number]
  // +0..+8: three floats (keyword 0x8b), or three ints × 2^-30 (keyword 0x8e).
  readonly vector: BspVolumeVector
  // +0xc, +0xe as int16.
  readonly shortValues: readonly [number, number]
}

export type BspVolume = {
  // Keyword 0x27: names looked up in the world's material library (0x10028c20), compared over eight characters.
  readonly materialNames: readonly string[]
  // Keyword 0x34 (0x1002be90, object vtable 0x100576a8): three floats per entry.
  readonly keyword34Vectors: readonly BspVolumeVector[]
  // Keyword 0x2d (0x1001bb10): four int16 per entry, at +0x14.
  readonly keyword2dEntries: readonly (readonly [number, number, number, number])[]
  // Keyword 0x8b or 0x8e, whichever came last.
  readonly nodes: readonly BspVolumeNode[]
  readonly readByteCount: number
}

export type BspVolumeShortQuadruple = BspVolume['keyword2dEntries'][number]
