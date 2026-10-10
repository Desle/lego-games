// One 8-byte entry of the 0x27 section (0x10026110).
export type MaterialAnimationMaterial = {
  // Looked up with 0x10028c20 in the world's materials ("Unable to find named material", fatal).
  readonly materialName: string
  // +4
  readonly value: number
}

// One 24-byte entry of the 0x28 section, filled by 0x10025d40 (offsets in that entry).
export type MaterialAnimationEntry = {
  // +6, +8 as int16; 0 and 1 by default.
  readonly keyword27Values: readonly [number, number]
  // +0xa as int16; 1 by default.
  readonly keyword29Value: number
  // +0xc: int × float32 0.001 (0x100570b8); 30 × 0.001 by default.
  readonly keyword2aValue: number
}

export type MaterialAnimation = {
  readonly materials: readonly MaterialAnimationMaterial[]
  readonly entries: readonly MaterialAnimationEntry[]
  readonly readByteCount: number
}
