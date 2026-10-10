import { BinaryToken } from '../binary-token/binary-token.ts'
import {
  TokenReaderError,
  TokenReaderOverflowError,
} from '../token-reader-errors/token-reader-errors.ts'
import { TokenReaderFailure } from '../token-reader-failure/token-reader-failure.ts'
import { createTokenReader } from './token-reader.ts'

const getFloatBytes = (value: number): number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)
  return [...bytes]
}

const getIntegerBytes = (value: number): number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setInt32(0, value, true)
  return [...bytes]
}

const getStringBytes = (value: string): number[] => [...new TextEncoder().encode(value), 0]

const readAllTokens = (bytes: number[]): number[] => {
  const reader = createTokenReader(new Uint8Array(bytes))
  const tokens: number[] = []
  for (
    let token = reader.getNextToken();
    token !== BinaryToken.END_OF_FILE;
    token = reader.getNextToken()
  ) {
    tokens.push(token)
  }
  return tokens
}

describe('createTokenReader', () => {
  it('reads strings, integers and floats with their values', () => {
    // Arrange
    const reader = createTokenReader(
      new Uint8Array([
        BinaryToken.STRING,
        ...getStringBytes('emitter'),
        BinaryToken.INTEGER,
        ...getIntegerBytes(-2),
        BinaryToken.FLOAT,
        ...getFloatBytes(0.5),
      ])
    )

    // Act
    const values = [reader.readString(), reader.readInteger(), reader.readFloat()]

    // Assert
    expect(values).toEqual(['emitter', -2, 0.5])
  })

  it('returns end of file once the data is exhausted, and keeps returning it', () => {
    // Arrange
    const reader = createTokenReader(new Uint8Array([BinaryToken.LEFT_CURLY]))

    // Act
    const tokens = [reader.getNextToken(), reader.getNextToken(), reader.getNextToken()]

    // Assert
    expect(tokens).toEqual([
      BinaryToken.LEFT_CURLY,
      BinaryToken.END_OF_FILE,
      BinaryToken.END_OF_FILE,
    ])
  })

  it('treats a truncated value as a syntax error', () => {
    // Arrange
    const reader = createTokenReader(new Uint8Array([BinaryToken.INTEGER, 1, 0]))

    // Act
    const read = () => reader.getNextToken()

    // Assert
    expect(read).toThrow(new TokenReaderError(TokenReaderFailure.SYNTAX_ERROR, 1))
  })

  it('treats a value token with no bytes after it as end of file', () => {
    // Arrange
    const reader = createTokenReader(new Uint8Array([BinaryToken.FLOAT]))

    // Act
    const token = reader.getNextToken()

    // Assert
    expect(token).toBe(BinaryToken.END_OF_FILE)
  })

  it('converts the compact numeric encodings', () => {
    // Arrange
    const reader = createTokenReader(
      new Uint8Array([
        BinaryToken.UNSIGNED_BYTE,
        0xff,
        BinaryToken.SIGNED_SHORT,
        0xfe,
        0xff,
        BinaryToken.UNSIGNED_SHORT,
        0xfe,
        0xff,
        BinaryToken.SHORT_DIVIDED_BY_4096,
        0x00,
        0x18,
        BinaryToken.SHORT_DIVIDED_BY_32,
        0xf0,
        0xff,
        BinaryToken.SHORT_AS_FLOAT,
        0x07,
        0x00,
        BinaryToken.BYTE_DIVIDED_BY_127,
        127,
      ])
    )

    // Act
    const values = [
      reader.readInteger(),
      reader.readInteger(),
      reader.readInteger(),
      reader.readFloat(),
      reader.readFloat(),
      reader.readFloat(),
      reader.readFloat(),
    ]

    // Assert
    expect(values).toEqual([255, -2, 65534, 1.5, -0.5, 7, 1])
  })

  it('reads an extended token as a 16-bit token id', () => {
    // Arrange
    const bytes = [BinaryToken.EXTENDED_TOKEN, 0x34, 0x12]

    // Act
    const tokens = readAllTokens(bytes)

    // Assert
    expect(tokens).toEqual([0x1234])
  })

  it('replays a defined macro, reading each value from the data that follows', () => {
    // Arrange
    const reader = createTokenReader(
      new Uint8Array([
        BinaryToken.LEFT_CURLY,
        BinaryToken.DEFINE_MACRO,
        0x17,
        4,
        0x31,
        BinaryToken.FLOAT,
        BinaryToken.FLOAT,
        BinaryToken.FLOAT,
        0x17,
        ...getFloatBytes(1),
        ...getFloatBytes(2),
        ...getFloatBytes(3),
      ])
    )

    // Act
    const tokens = [reader.getNextToken(), reader.getNextToken()]
    const values = [reader.readFloat(), reader.readFloat(), reader.readFloat()]

    // Assert
    expect(tokens).toEqual([BinaryToken.LEFT_CURLY, 0x31])
    expect(values).toEqual([1, 2, 3])
    expect(reader.getNextToken()).toBe(BinaryToken.END_OF_FILE)
  })

  it('repeats a macro the given number of times', () => {
    // Arrange
    const bytes = [
      BinaryToken.LEFT_CURLY,
      BinaryToken.DEFINE_MACRO,
      0x18,
      2,
      BinaryToken.LEFT_BRACKET,
      BinaryToken.RIGHT_BRACKET,
      BinaryToken.REPEAT,
      3,
      0,
      0x18,
    ]

    // Act
    const tokens = readAllTokens(bytes)

    // Assert
    expect(tokens).toEqual([
      BinaryToken.LEFT_CURLY,
      ...[1, 2, 3].flatMap(() => [BinaryToken.LEFT_BRACKET, BinaryToken.RIGHT_BRACKET]),
    ])
  })

  it('repeats a plain token the given number of times', () => {
    // Arrange
    const bytes = [BinaryToken.REPEAT, 2, 0, BinaryToken.RIGHT_CURLY, BinaryToken.LEFT_CURLY]

    // Act
    const tokens = readAllTokens(bytes)

    // Assert
    expect(tokens).toEqual([
      BinaryToken.RIGHT_CURLY,
      BinaryToken.RIGHT_CURLY,
      BinaryToken.LEFT_CURLY,
    ])
  })

  it('expands the array header token from the table at 0x100577f8', () => {
    // Arrange
    const bytes = [BinaryToken.ARRAY_HEADER, ...getIntegerBytes(5)]

    // Act
    const tokens = readAllTokens(bytes)

    // Assert
    expect(tokens).toEqual([
      BinaryToken.LEFT_BRACKET,
      BinaryToken.INTEGER,
      BinaryToken.RIGHT_BRACKET,
      BinaryToken.RIGHT_BRACKET,
    ])
  })

  it('ends the file when a macro definition is the first token, as the original does', () => {
    // Arrange
    const bytes = [BinaryToken.DEFINE_MACRO, 0x17, 1, BinaryToken.LEFT_CURLY, 0x17]

    // Act
    const tokens = readAllTokens(bytes)

    // Assert
    expect(tokens).toEqual([])
  })

  it('cuts a string at 63 bytes and skips the byte after it', () => {
    // Arrange
    const reader = createTokenReader(
      new Uint8Array([BinaryToken.STRING, ...Array<number>(64).fill(0x41), BinaryToken.LEFT_CURLY])
    )

    // Act
    const value = reader.readString()
    const token = reader.getNextToken()

    // Assert
    expect(value).toBe('A'.repeat(63))
    expect(token).toBe(BinaryToken.LEFT_CURLY)
  })

  it('returns the last token again after it is pushed back', () => {
    // Arrange
    const reader = createTokenReader(new Uint8Array([BinaryToken.LEFT_CURLY]))
    reader.getNextToken()

    // Act
    reader.pushBackToken()
    const token = reader.getNextToken()

    // Assert
    expect(token).toBe(BinaryToken.LEFT_CURLY)
  })

  it('reads an array count in brackets followed by a left curly', () => {
    // Arrange
    const reader = createTokenReader(
      new Uint8Array([
        BinaryToken.LEFT_BRACKET,
        BinaryToken.INTEGER,
        ...getIntegerBytes(3),
        BinaryToken.RIGHT_BRACKET,
        BinaryToken.LEFT_CURLY,
      ])
    )

    // Act
    const count = reader.readArrayCount()

    // Assert
    expect(count).toBe(3)
  })

  it('reports the failure the original reports for a wrong token', () => {
    // Arrange
    const reader = createTokenReader(new Uint8Array([BinaryToken.LEFT_CURLY]))

    // Act
    const read = () => reader.readInteger()

    // Assert
    expect(read).toThrow(new TokenReaderError(TokenReaderFailure.EXPECTED_INTEGER, 1))
  })

  it('rejects a string longer than the allowed maximum', () => {
    // Arrange
    const reader = createTokenReader(new Uint8Array([BinaryToken.STRING, ...getStringBytes('abc')]))

    // Act
    const read = () => reader.readStringWithMaximumLength(2)

    // Assert
    expect(read).toThrow(new TokenReaderError(TokenReaderFailure.INVALID_STRING, 5))
  })

  it('refuses a macro definition outside the original macro table', () => {
    // Arrange
    const reader = createTokenReader(new Uint8Array([BinaryToken.DEFINE_MACRO, 0x27, 0]))

    // Act
    const read = () => reader.getNextToken()

    // Assert
    expect(read).toThrow(TokenReaderOverflowError)
  })
})
