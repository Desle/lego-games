// The 18-byte header GolDP.dll 0x1002a5e0 reads (offsets in the file) and the fields it derives.
export type TargaHeader = {
  // +0: bytes between the header and the colour map.
  readonly identifierLength: number
  // +1: non-zero when a colour map follows the identifier.
  readonly colorMapType: number
  // +2: 1, 2, 3 (stored as is) or 9, 10, 11 (run-length encoded: the loader treats `>= 9` as encoded).
  readonly imageType: number
  // +3, +5, +7: stored by the loader; only the length and entry size are used.
  readonly colorMapOrigin: number
  readonly colorMapLength: number
  readonly colorMapEntryBits: number
  // +8, +10: stored and never read again.
  readonly originX: number
  readonly originY: number
  // +12, +14, +16
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
  // +17: stored and never read again; rows are placed by the caller's flag instead.
  readonly descriptor: number
  // Bytes per row in the engine's storage: (width · bitsPerPixel + 31) / 8, rounded down to four bytes.
  readonly stride: number
  // Where the pixel data is read from: after the identifier and, for depths up to 8 bits, the colour map.
  readonly pixelDataOffset: number
  // Colour map entries the loader keeps, at most 256.
  readonly paletteCount: number
  // Always 1024 bytes of R, G, B, A.
  readonly palette: Uint8Array
}

export type TargaDecodeOptions = {
  // Texture flag 4 (TDB keyword 0x28). Without it the engine stores the file's first row as the last row of the
  // texture (0x1002ae50); with it the first row stays first.
  readonly isFirstRowOnTop: boolean
}
