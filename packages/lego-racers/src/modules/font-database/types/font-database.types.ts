export type FontByteTriple = readonly [number, number, number]

// What GolDP.dll 0x1001d8f0 stores into each font object (offsets in that object).
export type FontDefinition = {
  readonly name: string
  // +0x2c: keywords 0x28 (8, clears 0x10), 0x29 (0x10, clears 8), 0x2a (0x20, then 0x800).
  readonly flags: number
  // +0x38 when flag 0x20 is set; 0 0 0 without keyword 0x2a, fourth byte 0xff.
  readonly keyword2aBytes: FontByteTriple
  // 16-bit character codes of keyword 0x2b, in file order; null without it.
  readonly characters: readonly number[] | null
  // +0x20; null without keyword 0x2c (the loader leaves the field as constructed).
  readonly keyword2cValue: number | null
  // +0x3c; 0xff 0xff 0xff without keyword 0x2d, fourth byte 0xff.
  readonly keyword2dBytes: FontByteTriple
}

export type FontDatabase = {
  readonly fonts: readonly FontDefinition[]
  readonly readByteCount: number
}
