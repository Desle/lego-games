import { encodeFloat, encodeInteger } from '../token-encoding/token-encoding.ts'

// Helpers on top of the shared token encoder, used by the race-file specs.
export const floatTokens = (values: readonly number[]): readonly number[] =>
  values.flatMap((value) => encodeFloat(value))

export const integerTokens = (values: readonly number[]): readonly number[] =>
  values.flatMap((value) => encodeInteger(value))

export const LEFT_CURLY = 0x05
export const RIGHT_CURLY = 0x06
