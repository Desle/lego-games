import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import { createNameTable } from '../../../../shared/name-table/name-table.ts'
import type { NameTable } from '../../../../shared/name-table/name-table.types.ts'
import {
  FONT_CHARACTER_CAPACITY,
  FONT_KEYWORD_2A_EXTRA_FLAG,
  FONT_KEYWORD_2A_FLAG,
  FONT_NAME_LENGTH,
  FontDatabaseKeyword,
} from '../../types/font-database-keyword/font-database-keyword.ts'
import type {
  FontByteTriple,
  FontDatabase,
  FontDefinition,
} from '../../types/font-database.types.ts'

const readByteTriple = (reader: TokenReader): FontByteTriple => {
  const first = getUnsignedByte(reader.readInteger())
  const second = getUnsignedByte(reader.readInteger())
  const third = getUnsignedByte(reader.readInteger())
  return Object.freeze([first, second, third] as const)
}

const readCharacter = (reader: TokenReader, token: number): number => {
  if (token === BinaryToken.STRING) {
    const value = reader.getStringValue()
    if (value.length > 1) reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    // strncpy of one character: an empty string gives 0.
    return value.length === 0 ? 0 : value.charCodeAt(0)
  }
  if (token === BinaryToken.INTEGER) {
    const value = reader.getIntegerValue()
    if (value < 0 || value > 0xffff) reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    return value
  }
  return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
}

// 0x1001dd20: `[ (one-character string | int 0..0xffff)... ]`.
const readCharacters = (reader: TokenReader): readonly number[] => {
  if (reader.getNextToken() !== BinaryToken.LEFT_BRACKET) {
    reader.fail(TokenReaderFailure.EXPECTED_LEFT_BRACKET)
  }
  const characters: number[] = []
  for (
    let token = reader.getNextToken();
    token !== BinaryToken.RIGHT_BRACKET;
    token = reader.getNextToken()
  ) {
    if (characters.length === FONT_CHARACTER_CAPACITY) {
      throw new UnportableFileError(
        'More font characters than the loader stack buffer holds',
        reader.getPosition()
      )
    }
    characters.push(readCharacter(reader, token))
  }
  return Object.freeze(characters)
}

// 0x1001da5a..0x1001dc49: `0x27 "name" { keyword... }`.
const readFont = (reader: TokenReader, names: NameTable, index: number): FontDefinition => {
  reader.expectToken(FontDatabaseKeyword.FONT)
  const name = reader.readStringWithMaximumLength(FONT_NAME_LENGTH)
  names.add(name, index)
  reader.expectLeftCurly()

  let flags = 0
  let keyword2aBytes: FontByteTriple = Object.freeze([0, 0, 0] as const)
  let characters: readonly number[] | null = null
  let keyword2cValue: number | null = null
  let keyword2dBytes: FontByteTriple = Object.freeze([0xff, 0xff, 0xff] as const)
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case FontDatabaseKeyword.FLAG_0X8:
        flags = (flags & 0xffef) | 0x8
        break
      case FontDatabaseKeyword.FLAG_0X10:
        flags = (flags & 0xfff7) | 0x10
        break
      case FontDatabaseKeyword.KEYWORD_2A:
        flags |= FONT_KEYWORD_2A_FLAG
        keyword2aBytes = readByteTriple(reader)
        break
      case FontDatabaseKeyword.CHARACTERS:
        characters = readCharacters(reader)
        break
      case FontDatabaseKeyword.KEYWORD_2C:
        keyword2cValue = reader.readInteger()
        break
      case FontDatabaseKeyword.KEYWORD_2D:
        keyword2dBytes = readByteTriple(reader)
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }

  const isKeyword2aFlagSet = (flags & FONT_KEYWORD_2A_FLAG) !== 0
  return Object.freeze({
    name,
    flags: isKeyword2aFlagSet ? flags | FONT_KEYWORD_2A_EXTRA_FLAG : flags,
    keyword2aBytes,
    characters,
    keyword2cValue,
    keyword2dBytes,
  })
}

// GolDP.dll 0x1001d8f0: `0x27 [ count ] { font... }`; a count of 0 stops after the `{`.
export const parseFontDatabase = (bytes: Uint8Array): FontDatabase => {
  const reader = createTokenReader(bytes)
  reader.expectToken(FontDatabaseKeyword.FONT)
  const count = reader.readArrayCount()
  const fonts: FontDefinition[] = []
  if (count !== 0) {
    const names = createNameTable()
    for (let index = 0; index < count >>> 0; index++) fonts.push(readFont(reader, names, index))
    reader.expectRightCurly()
  }
  return Object.freeze({ fonts: Object.freeze(fonts), readByteCount: reader.getPosition() })
}
