// Builds binary token streams (layout in .docs/reverse-engineering/token-reader.md) for tests.
export const encodeString = (value: string): readonly number[] => [
  0x02,
  ...Array.from({ length: value.length }, (_, index) => value.charCodeAt(index)),
  0x00,
]

export const encodeInteger = (value: number): readonly number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setInt32(0, value, true)
  return [0x04, ...bytes]
}

export const encodeFloat = (value: number): readonly number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)
  return [0x03, ...bytes]
}

export const encodeArrayHeader = (count: number): readonly number[] => [
  0x07,
  ...encodeInteger(count),
  0x08,
  0x05,
]

export const encodeExtendedKeyword = (keyword: number): readonly number[] => [
  0x13,
  keyword & 0xff,
  keyword >> 8,
]
