export type AnimationTriple = readonly [number, number, number]

export type AnimationQuadruple = readonly [number, number, number, number]

// Keyword 0x2b (0x10018a80), in file order: int +0, int +4, int16 +0x10, int +8, int +0xc, int16 +0x12.
export type AnimationKeyword2bEntry = readonly [number, number, number, number, number, number]

// One 40-byte entry of keyword 0x2c (constructor 0x10018640, body 0x10018670).
export type AnimationKeyword2cEntry = {
  // Read with 0x100326e0 (no length limit); the name table keys on the first eight characters.
  readonly name: string
  // +0: int × float32 0.001 (0x10056a4c); 0 by default.
  readonly keyword2fValue: number
  // +4..+0xc; 0 0 0 by default.
  readonly keyword30Values: AnimationTriple
  // +0x10..+0x1c; 0 0 0 0x7effffff by default.
  readonly keyword31Values: AnimationQuadruple
  // +0x20 int; 0 by default.
  readonly keyword2bValue: number
  // +0x24 int16; 0 by default.
  readonly keyword2dValue: number
  // +0x26 uint16 (0x10018790 converts it unsigned); 0 by default.
  readonly keyword2eValue: number
}

export type Animation = {
  // Keyword 0x27 → 0x28: three floats per entry (+0xc of the 0x27 object).
  readonly keyword28Triples: readonly AnimationTriple[]
  // Keyword 0x27 → 0x29: four floats per entry (+0x10).
  readonly keyword29Quadruples: readonly AnimationQuadruple[]
  // Keyword 0x27 → 0x2a: int16 per entry (+0x14).
  readonly keyword2aValues: readonly number[]
  readonly keyword2bEntries: readonly AnimationKeyword2bEntry[]
  readonly keyword2cEntries: readonly AnimationKeyword2cEntry[]
  readonly readByteCount: number
}
