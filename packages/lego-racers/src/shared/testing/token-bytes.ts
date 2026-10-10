// Encoders for the binary token language, used by the format specs to build small files.
export const stringToken = (value: string): readonly number[] => [
  0x02,
  ...Array.from({ length: value.length }, (_, index) => value.charCodeAt(index)),
  0x00,
]

export const floatToken = (value: number): readonly number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)
  return [0x03, ...bytes]
}

export const integerToken = (value: number): readonly number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setInt32(0, value, true)
  return [0x04, ...bytes]
}

export const floatTokens = (values: readonly number[]): readonly number[] =>
  values.flatMap(floatToken)

export const integerTokens = (values: readonly number[]): readonly number[] =>
  values.flatMap(integerToken)

export const arrayHeaderTokens = (count: number): readonly number[] => [
  0x07,
  ...integerToken(count),
  0x08,
  0x05,
]

export const LEFT_CURLY = 0x05
export const RIGHT_CURLY = 0x06
