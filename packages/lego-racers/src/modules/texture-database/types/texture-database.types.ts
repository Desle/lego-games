export type ByteTriple = readonly [number, number, number]

// What GolDP.dll 0x1002b5a0 stores into each texture object (offsets in that object).
export type TextureDefinition = {
  readonly name: string
  // False when an earlier texture of the same file has the name: 0x1002b721 then blanks the stored name.
  readonly isNameRegistered: boolean
  // +0x36, uint16: keywords 0x28 (4), 0x29 (1), 0x2a (8, clears 0x10), 0x2b (0x10, clears 8), 0x2c (0x20), 0x2d (0x100), 0x2e (0x200); 0x800 always.
  readonly flags: number
  // +0x34, int16; 0 without keyword 0x29.
  readonly keyword29Value: number
  // +0x30..+0x32; 0 0 0 without keyword 0x2c (+0x33 is always 0).
  readonly keyword2cBytes: ByteTriple
}

export type TextureDatabase = {
  readonly textures: readonly TextureDefinition[]
  readonly readByteCount: number
}
