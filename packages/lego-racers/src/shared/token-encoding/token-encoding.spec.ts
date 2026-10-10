import {
  encodeArrayHeader,
  encodeExtendedKeyword,
  encodeFloat,
  encodeInteger,
  encodeString,
} from './token-encoding.ts'

describe('token encoding', () => {
  it('encodes strings, integers, floats, array headers and extended keywords', () => {
    // Arrange
    const values = { text: 'ab', integer: -2, float: 1, count: 3, keyword: 0x8b }

    // Act
    const encoded = [
      encodeString(values.text),
      encodeInteger(values.integer),
      encodeFloat(values.float),
      encodeArrayHeader(values.count),
      encodeExtendedKeyword(values.keyword),
    ]

    // Assert
    expect(encoded).toEqual([
      [0x02, 0x61, 0x62, 0x00],
      [0x04, 0xfe, 0xff, 0xff, 0xff],
      [0x03, 0x00, 0x00, 0x80, 0x3f],
      [0x07, 0x04, 0x03, 0x00, 0x00, 0x00, 0x08, 0x05],
      [0x13, 0x8b, 0x00],
    ])
  })
})
