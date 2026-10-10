export type ImageByteTriple = readonly [number, number, number]

// What GolDP.dll 0x10023060 stores into each image object (offsets in that object).
export type ImageDefinition = {
  readonly name: string
  // +0x40, uint16: keywords 0x28 (4), 0x29 (8, clears 0x10), 0x2a (0x10, clears 8), 0x2b (0x20, then 0x800).
  // The loader also sets 0x40 and 0x80 from device capabilities (0x100232cc, 0x100232e2); not included.
  readonly flags: number
  // +0x28 (copied from +0x30..+0x32 when flag 0x20 is set); 0 0 0 without keyword 0x2b, fourth byte 0xff.
  readonly keyword2bBytes: ImageByteTriple
  // +0x4a..+0x4c; 0xff 0xff 0xff without keyword 0x2c, fourth byte 0xff.
  readonly keyword2cBytes: ImageByteTriple
}

export type ImageDatabase = {
  readonly images: readonly ImageDefinition[]
  readonly readByteCount: number
}
