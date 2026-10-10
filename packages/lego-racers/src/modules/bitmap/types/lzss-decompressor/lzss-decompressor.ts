import { InvalidBitmapError } from '../bitmap-errors/bitmap-errors.ts'

const MINIMUM_MATCH_LENGTH_BASE = 0x12

// LZSS at GolDP.dll 0x10032840 (cdecl: source, destination; returns the bytes written). The destination is the start
// of `buffer` and the source lies inside it, as the engine decodes every block in one buffer.
export const decompressLzss = (buffer: Uint8Array, sourceStart: number): number => {
  const readBufferByte = (index: number): number => buffer[index] ?? 0

  const writeBufferByte = (index: number, value: number): void => {
    if (index >= buffer.byteLength) throw new InvalidBitmapError('BMP block overflow')
    // eslint-disable-next-line no-param-reassign -- the engine decodes in place, inside the caller's block buffer
    buffer[index] = value
  }

  let source = sourceStart
  let destination = 0
  writeBufferByte(destination++, readBufferByte(source++))
  for (;;) {
    const flags = readBufferByte(source++)
    for (let bit = 7; bit >= 0; bit--) {
      if (((flags >> bit) & 1) === 0) {
        writeBufferByte(destination++, readBufferByte(source++))
        continue
      }
      const token = readBufferByte(source++)
      const lengthCode = token & 0xf
      const distance = ((token >> 4) << 8) | readBufferByte(source)
      // A zero length nibble reads one more byte, before the end-of-stream check, as the original does.
      const length =
        lengthCode === 0
          ? readBufferByte(source + 1) + MINIMUM_MATCH_LENGTH_BASE
          : MINIMUM_MATCH_LENGTH_BASE - lengthCode
      source += lengthCode === 0 ? 2 : 1
      if (distance === 0) return destination
      for (let copied = 0; copied < length; copied++) {
        writeBufferByte(destination, readBufferByte(destination - distance))
        destination++
      }
    }
  }
}
