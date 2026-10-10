import { BinaryToken } from '../binary-token/binary-token.ts'
import {
  TokenReaderError,
  TokenReaderOverflowError,
} from '../token-reader-errors/token-reader-errors.ts'
import { TokenReaderFailure } from '../token-reader-failure/token-reader-failure.ts'
import type {
  TokenReader,
  TokenReaderFailure as TokenReaderFailureValue,
} from './token-reader.types.ts'

const STRING_READ_LENGTH = 0x3f
const MACRO_COUNT = 16
const MACRO_SLOT_COUNT = 16
// Token 0x15 replays this table (GolDP.dll 0x100577f8): '[' int ']' ']'.
const ARRAY_HEADER_EXPANSION: readonly number[] = Object.freeze([
  BinaryToken.LEFT_BRACKET,
  BinaryToken.INTEGER,
  BinaryToken.RIGHT_BRACKET,
  BinaryToken.RIGHT_BRACKET,
])
// Initialised at runtime by 0x1002ff80, 0x1002ffb0 and 0x1002ffd0 as 1.0f / divisor.
const ONE_OVER_4096 = Math.fround(1 / 4096)
const ONE_OVER_32 = Math.fround(1 / 32)
const ONE_OVER_127 = Math.fround(1 / 127)

const getIsMacroToken = (token: number) =>
  token >= BinaryToken.FIRST_MACRO && token <= BinaryToken.LAST_MACRO

export const createTokenReader = (bytes: Uint8Array): TokenReader => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const macroTokens = new Int32Array(MACRO_COUNT * MACRO_SLOT_COUNT)
  const macroLengths = new Int32Array(MACRO_COUNT)
  let position = 0
  let isTokenPushedBack = false
  let lastToken = 0
  let integerValue = 0
  let floatValue = 0
  let stringValue = ''
  let repeatCount = 0
  let repeatToken = 0
  let isExpandingArrayHeader = false
  let isExpandingMacro = false
  let macroIndex = 0
  let expansionPosition = 0

  const fail = (failure: TokenReaderFailureValue): never => {
    throw new TokenReaderError(failure, position)
  }

  const getAvailableByteCount = (count: number) =>
    Math.max(0, Math.min(count, bytes.byteLength - position))

  // The stream reports end of file only when nothing is left; a short read is a syntax error.
  const getIsEndOfFile = (count: number): boolean => {
    const availableByteCount = getAvailableByteCount(count)
    if (availableByteCount === 0) return true
    if (availableByteCount !== count) fail(TokenReaderFailure.SYNTAX_ERROR)
    return false
  }

  const readByte = (): number => {
    const value = view.getUint8(position)
    position += 1
    return value
  }

  const readUnsignedShort = (): number => {
    const value = view.getUint16(position, true)
    position += 2
    return value
  }

  const readSignedShort = (): number => {
    const value = view.getInt16(position, true)
    position += 2
    return value
  }

  const returnEndOfFile = (): number => {
    lastToken = BinaryToken.END_OF_FILE
    return BinaryToken.END_OF_FILE
  }

  const returnToken = (token: number): number => {
    lastToken = token
    return token
  }

  const getMacroSlot = (index: number, slot: number): number => {
    const flatSlot = index * MACRO_SLOT_COUNT + slot
    if (flatSlot >= macroTokens.length) throw new TokenReaderOverflowError(position)
    return flatSlot
  }

  // 0x10030da0
  const takeExpandedToken = (): number => {
    let token: number
    if (isExpandingMacro) {
      token = macroTokens[getMacroSlot(macroIndex, expansionPosition)] ?? 0
      expansionPosition += 1
      if (expansionPosition < (macroLengths[macroIndex] ?? 0)) return token
      expansionPosition = 0
    } else if (isExpandingArrayHeader) {
      token = ARRAY_HEADER_EXPANSION[expansionPosition] ?? 0
      expansionPosition += 1
      if (expansionPosition < ARRAY_HEADER_EXPANSION.length) return token
      expansionPosition = 0
    } else {
      token = repeatToken
    }
    repeatCount -= 1
    if (repeatCount === 0) {
      isExpandingMacro = false
      isExpandingArrayHeader = false
    }
    return token
  }

  // 0x10030c30
  const readMacroDefinition = (): void => {
    if (getIsEndOfFile(2)) {
      lastToken = BinaryToken.END_OF_FILE
      return
    }
    const index = readByte() - BinaryToken.FIRST_MACRO
    const length = readByte()
    if (index < 0 || index >= MACRO_COUNT) throw new TokenReaderOverflowError(position)
    macroLengths[index] = length
    for (let slot = 0; slot < length; slot++) {
      if (getIsEndOfFile(1)) {
        lastToken = BinaryToken.END_OF_FILE
        return
      }
      let token = readByte()
      if (token === BinaryToken.EXTENDED_TOKEN) {
        if (getIsEndOfFile(2)) {
          lastToken = BinaryToken.END_OF_FILE
          return
        }
        token = readUnsignedShort()
      }
      macroTokens[getMacroSlot(index, slot)] = token
    }
  }

  const readString = (): number => {
    const availableByteCount = getAvailableByteCount(STRING_READ_LENGTH)
    if (availableByteCount === 0) return returnEndOfFile()
    let length = 0
    while (length < availableByteCount && bytes[position + length] !== 0) length += 1
    stringValue = String.fromCharCode(...bytes.subarray(position, position + length))
    position += length + 1
    return returnToken(BinaryToken.STRING)
  }

  // 0x10030300
  const getNextToken = (): number => {
    if (isTokenPushedBack) {
      isTokenPushedBack = false
      return lastToken
    }
    for (;;) {
      let token: number
      if (repeatCount === 0) {
        if (getIsEndOfFile(1)) return returnEndOfFile()
        token = readByte()
      } else {
        token = takeExpandedToken()
      }
      switch (token) {
        case BinaryToken.STRING:
          return readString()
        case BinaryToken.FLOAT:
          if (getIsEndOfFile(4)) return returnEndOfFile()
          floatValue = view.getFloat32(position, true)
          position += 4
          return returnToken(BinaryToken.FLOAT)
        case BinaryToken.INTEGER:
          if (getIsEndOfFile(4)) return returnEndOfFile()
          integerValue = view.getInt32(position, true)
          position += 4
          return returnToken(BinaryToken.INTEGER)
        case BinaryToken.UNSIGNED_BYTE:
        case BinaryToken.UNSIGNED_BYTE_ALTERNATE:
          if (getIsEndOfFile(1)) return returnEndOfFile()
          integerValue = readByte()
          return returnToken(BinaryToken.INTEGER)
        case BinaryToken.SIGNED_SHORT:
          if (getIsEndOfFile(2)) return returnEndOfFile()
          integerValue = readSignedShort()
          return returnToken(BinaryToken.INTEGER)
        case BinaryToken.UNSIGNED_SHORT:
          if (getIsEndOfFile(2)) return returnEndOfFile()
          integerValue = readUnsignedShort()
          return returnToken(BinaryToken.INTEGER)
        case BinaryToken.SHORT_DIVIDED_BY_4096:
          if (getIsEndOfFile(2)) return returnEndOfFile()
          floatValue = Math.fround(readSignedShort() * ONE_OVER_4096)
          return returnToken(BinaryToken.FLOAT)
        case BinaryToken.SHORT_DIVIDED_BY_32:
          if (getIsEndOfFile(2)) return returnEndOfFile()
          floatValue = Math.fround(readSignedShort() * ONE_OVER_32)
          return returnToken(BinaryToken.FLOAT)
        case BinaryToken.SHORT_AS_FLOAT:
          if (getIsEndOfFile(2)) return returnEndOfFile()
          floatValue = readSignedShort()
          return returnToken(BinaryToken.FLOAT)
        case BinaryToken.BYTE_DIVIDED_BY_127:
          if (getIsEndOfFile(1)) return returnEndOfFile()
          floatValue = Math.fround(readByte() * ONE_OVER_127)
          return returnToken(BinaryToken.FLOAT)
        case BinaryToken.EXTENDED_TOKEN:
          if (getIsEndOfFile(2)) return returnEndOfFile()
          return returnToken(readUnsignedShort())
        case BinaryToken.REPEAT: {
          if (getIsEndOfFile(2)) return returnEndOfFile()
          repeatCount = readUnsignedShort()
          if (getIsEndOfFile(1)) return returnEndOfFile()
          repeatToken = readByte()
          if (repeatToken === BinaryToken.EXTENDED_TOKEN) {
            if (getIsEndOfFile(2)) return returnEndOfFile()
            repeatToken = readUnsignedShort()
          }
          isExpandingMacro = false
          if (getIsMacroToken(repeatToken)) {
            macroIndex = repeatToken - BinaryToken.FIRST_MACRO
            expansionPosition = 0
            isExpandingMacro = true
          } else if (repeatToken === BinaryToken.ARRAY_HEADER) {
            isExpandingArrayHeader = true
            expansionPosition = 0
          }
          continue
        }
        case BinaryToken.ARRAY_HEADER:
          repeatCount = 1
          isExpandingArrayHeader = true
          expansionPosition = 0
          isExpandingMacro = false
          continue
        case BinaryToken.DEFINE_MACRO:
          readMacroDefinition()
          // The original tests the previous token here, so a definition at the very start ends the file.
          if (lastToken === BinaryToken.END_OF_FILE) return BinaryToken.END_OF_FILE
          continue
        default:
          if (getIsMacroToken(token)) {
            macroIndex = token - BinaryToken.FIRST_MACRO
            expansionPosition = 0
            isExpandingMacro = true
            repeatCount = 1
            continue
          }
          return returnToken(token)
      }
    }
  }

  const expectValueToken = (token: number, failure: TokenReaderFailureValue): void => {
    if (getNextToken() !== token) fail(failure)
  }

  const readInteger = (): number => {
    expectValueToken(BinaryToken.INTEGER, TokenReaderFailure.EXPECTED_INTEGER)
    return integerValue
  }

  const readStringValue = (): string => {
    expectValueToken(BinaryToken.STRING, TokenReaderFailure.EXPECTED_STRING)
    return stringValue
  }

  const readStringWithMaximumLength = (maximumLength: number): string => {
    const value = readStringValue()
    if (maximumLength < value.length) fail(TokenReaderFailure.INVALID_STRING)
    return value
  }

  const expectLeftCurly = () =>
    expectValueToken(BinaryToken.LEFT_CURLY, TokenReaderFailure.EXPECTED_LEFT_CURLY)
  const expectRightCurly = () =>
    expectValueToken(BinaryToken.RIGHT_CURLY, TokenReaderFailure.EXPECTED_RIGHT_CURLY)
  const expectLeftBracket = () =>
    expectValueToken(BinaryToken.LEFT_BRACKET, TokenReaderFailure.EXPECTED_LEFT_BRACKET)
  const expectRightBracket = () =>
    expectValueToken(BinaryToken.RIGHT_BRACKET, TokenReaderFailure.EXPECTED_RIGHT_BRACKET)

  const readArrayCount = (): number => {
    expectLeftBracket()
    const count = readInteger()
    expectRightBracket()
    expectLeftCurly()
    return count
  }

  return Object.freeze({
    getNextToken,
    pushBackToken: () => {
      isTokenPushedBack = true
    },
    getIntegerValue: () => integerValue,
    getFloatValue: () => floatValue,
    getStringValue: () => stringValue,
    getPosition: () => position,
    fail,
    expectToken: (token: number) => expectValueToken(token, TokenReaderFailure.EXPECTED_KEYWORD),
    readInteger,
    readFloat: (): number => {
      expectValueToken(BinaryToken.FLOAT, TokenReaderFailure.EXPECTED_FLOAT)
      return floatValue
    },
    readString: readStringValue,
    readStringWithMaximumLength,
    expectLeftCurly,
    expectRightCurly,
    expectLeftBracket,
    expectRightBracket,
    readArrayCount,
  })
}
