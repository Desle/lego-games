import {
  InvalidRandomTableError,
  RandomDivisorError,
} from '../random-table-errors/random-table-errors.ts'
import type { RandomDraw, RandomTable, RandomTablePosition } from '../random-table.types.ts'

export const RANDOM_TABLE_ADDRESS = 0x004befec
export const RANDOM_TABLE_POSITION_ADDRESS = 0x004c6ee4
export const RANDOM_TABLE_LENGTH = 1024
export const RANDOM_TABLE_BYTE_LENGTH = RANDOM_TABLE_LENGTH * 2
const POSITION_MASK = 0x3ff
const MAXIMUM_VALUE = 1023
const LOW_BYTE_MASK = 0xff
// The timers' threshold (0x00464750, 0x00464830, 0x004648d0): from 0x400 on, the value scales the range.
const SCALED_RANGE_THRESHOLD = 0x400
const SCALED_RANGE_DIVISOR = 0x3ff

export const createRandomTable = (values: readonly number[]): RandomTable => {
  if (values.length !== RANDOM_TABLE_LENGTH) {
    throw new InvalidRandomTableError(
      `Expected ${String(RANDOM_TABLE_LENGTH)} values, got ${String(values.length)}`
    )
  }
  const invalidIndex = values.findIndex(
    (value) => !Number.isInteger(value) || value < 0 || value > MAXIMUM_VALUE
  )
  if (invalidIndex !== -1) {
    throw new InvalidRandomTableError(
      `Value ${String(values[invalidIndex])} at index ${String(invalidIndex)} is outside 0..1023`
    )
  }
  return Object.freeze({ values: Object.freeze([...values]) })
}

export const decodeRandomTable = (bytes: Uint8Array): RandomTable => {
  if (bytes.byteLength !== RANDOM_TABLE_BYTE_LENGTH) {
    throw new InvalidRandomTableError(
      `Expected ${String(RANDOM_TABLE_BYTE_LENGTH)} bytes, got ${String(bytes.byteLength)}`
    )
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return createRandomTable(
    Array.from({ length: RANDOM_TABLE_LENGTH }, (_, index) => view.getUint16(index * 2, true))
  )
}

export const createRandomTablePosition = (position: number): RandomTablePosition => {
  if (!Number.isInteger(position) || position < 0 || position > POSITION_MASK) {
    throw new RangeError(`Random table position ${String(position)} is outside 0..1023`)
  }
  return position
}

// LEA EAX,[cursor + 1]; AND EAX,0x3ff; MOV [0x004c6ee4],EAX: the position always advances before the read.
export const getNextRandomTablePosition = (position: RandomTablePosition): RandomTablePosition =>
  (position + 1) & POSITION_MASK

const getValueAt = (table: RandomTable, position: RandomTablePosition): number =>
  table.values[position] ?? 0

// MOV r16,word ptr [position*2 + 0x004befec] into a zeroed register.
export const drawRandomValue = (table: RandomTable, position: RandomTablePosition): RandomDraw => {
  const nextPosition = getNextRandomTablePosition(position)
  return Object.freeze({ position: nextPosition, value: getValueAt(table, nextPosition) })
}

// DIV or IDIV of the zero-extended value; both give value % divisor because the value is never negative.
// AND 0x80000001 / 0x80000003 / 0x80000007 (the compiler's signed % 2, % 4, % 8) are the same reduction.
export const drawRandomRemainder = (
  table: RandomTable,
  position: RandomTablePosition,
  divisor: number
): RandomDraw => {
  if (divisor === 0) throw new RandomDivisorError(divisor)
  const draw = drawRandomValue(table, position)
  return Object.freeze({ position: draw.position, value: draw.value % divisor })
}

// MOV r8,byte ptr [position*2 + 0x004befec]: only the low byte, compared against a byte chance.
export const drawRandomLowByte = (
  table: RandomTable,
  position: RandomTablePosition
): RandomDraw => {
  const draw = drawRandomValue(table, position)
  return Object.freeze({ position: draw.position, value: draw.value & LOW_BYTE_MASK })
}

// The timers and triggers (0x00464750, 0x00464830, 0x004648d0): value % range below 0x400,
// otherwise (range / 1023) * value, the division by 1023 done with the magic multiplier 0x401005.
export const drawRandomScaledRange = (
  table: RandomTable,
  position: RandomTablePosition,
  range: number
): RandomDraw => {
  if (range < SCALED_RANGE_THRESHOLD) return drawRandomRemainder(table, position, range)
  const draw = drawRandomValue(table, position)
  return Object.freeze({
    position: draw.position,
    value: (Math.floor(range / SCALED_RANGE_DIVISOR) * draw.value) >>> 0,
  })
}
