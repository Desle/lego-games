import type { JamTextLine } from '../audio.types.ts'

const CARRIAGE_RETURN = 0x0d
const LINE_FEED = 0x0a
const END_OF_FILE_MARKER = 0x1a

const getText = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, end))

// 0x0044cff0 (JAM branch) and 0x0044da70: `maximumLength` is the caller's buffer size, NUL included.
export const readJamTextLine = (
  bytes: Uint8Array,
  position: number,
  maximumLength: number
): JamTextLine | undefined => {
  if (position >= bytes.byteLength || maximumLength <= 0) return undefined
  const limit = Math.min(maximumLength, bytes.byteLength - position)
  let isAfterCarriageReturn = false
  for (let index = 0; index < limit; index++) {
    const byte = bytes[position + index] ?? 0
    if (byte === LINE_FEED) {
      const textEnd = isAfterCarriageReturn ? index - 1 : index
      return Object.freeze({
        text: getText(bytes, position, position + textEnd),
        consumedByteCount: index + 1,
      })
    }
    if (byte === END_OF_FILE_MARKER || byte === 0) {
      return Object.freeze({
        text: getText(bytes, position, position + index),
        consumedByteCount: index + 1,
      })
    }
    isAfterCarriageReturn = byte === CARRIAGE_RETURN
  }
  // A full buffer without a line end keeps limit - 1 characters but still consumes limit bytes.
  const textLength = limit >= maximumLength ? limit - 1 : limit
  return Object.freeze({
    text: getText(bytes, position, position + textLength),
    consumedByteCount: limit,
  })
}
