export type BitmapHeader = {
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
  readonly colorCount: number
  readonly palette: Uint8Array
  readonly stride: number
  readonly pixelDataOffset: number
}

export type Bitmap = {
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
  readonly colorCount: number
  /** 256 RGBA entries, as the engine keeps them; entries past `colorCount` are zero. */
  readonly palette: Uint8Array
  /** Bytes per row in `pixels`, padded to four bytes as in the engine. */
  readonly stride: number
  /** Rows top to bottom. */
  readonly pixels: Uint8Array
}

export type BitmapBlockReader = {
  /** Fills `row` from the block stream starting at `position`; returns the position after the blocks it read. */
  readonly readRow: (file: Uint8Array, position: number, row: Uint8Array) => number
}
