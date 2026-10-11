import type { CarDesign } from '../../types/car-builder.types.ts'
import { BRICK_RECORD_BYTE_COUNT } from '../load-car-design/load-car-design.ts'

// The inverse of `loadCarDesign` (0x0049fb30): a big-endian count, then eight bytes per brick: the piece id (big-endian), x,
// y, orientation, colour and the brick's unidentified value (big-endian).
export const serializeCarDesign = (design: CarDesign): Uint8Array => {
  const bytes = new Uint8Array(2 + design.bricks.length * BRICK_RECORD_BYTE_COUNT)
  bytes[0] = design.bricks.length >> 8
  bytes[1] = design.bricks.length & 0xff
  design.bricks.forEach((brick, index) => {
    const offset = 2 + index * BRICK_RECORD_BYTE_COUNT
    bytes[offset] = brick.piece.id >> 8
    bytes[offset + 1] = brick.piece.id & 0xff
    bytes[offset + 2] = brick.x
    bytes[offset + 3] = brick.y
    bytes[offset + 4] = brick.orientation
    bytes[offset + 5] = brick.colorIndex
    bytes[offset + 6] = brick.unidentifiedValue >> 8
    bytes[offset + 7] = brick.unidentifiedValue & 0xff
  })
  return bytes
}
