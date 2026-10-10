import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { getSignedShort, getThousandthOf } from '../../../../shared/binary-values/binary-values.ts'
import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import {
  DEFAULT_KEYWORD_27_VALUES,
  DEFAULT_KEYWORD_29_VALUE,
  DEFAULT_KEYWORD_2A_INTEGER,
  MATERIAL_ANIMATION_NAME_LENGTH,
  MaterialAnimationKeyword,
} from '../../types/material-animation-keyword/material-animation-keyword.ts'
import type {
  MaterialAnimation,
  MaterialAnimationEntry,
  MaterialAnimationMaterial,
} from '../../types/material-animation.types.ts'

// Both sections: a count of 0 is error 15.
const readNonZeroCount = (reader: TokenReader): number => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.INVALID_VALUE)
  return count >>> 0
}

const getScaledValue = (reader: TokenReader, value: number): number => {
  const scaled = getThousandthOf(value)
  if (scaled === null) {
    throw new UnportableFileError(
      'Keyword 0x2a value too large to scale exactly',
      reader.getPosition()
    )
  }
  return scaled
}

// 0x10025a40: `0x27 [ count ] { ("name" int)… }`.
const readMaterials = (reader: TokenReader): readonly MaterialAnimationMaterial[] => {
  if (reader.getNextToken() !== MaterialAnimationKeyword.MATERIALS)
    reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
  const count = readNonZeroCount(reader)
  const materials: MaterialAnimationMaterial[] = []
  for (let index = 0; index < count; index++) {
    const materialName = reader.readStringWithMaximumLength(MATERIAL_ANIMATION_NAME_LENGTH)
    const value = reader.readInteger()
    materials.push(Object.freeze({ materialName, value }))
  }
  if (reader.getNextToken() !== BinaryToken.RIGHT_CURLY)
    reader.fail(TokenReaderFailure.EXPECTED_RIGHT_CURLY)
  return Object.freeze(materials)
}

// 0x10025c0d..0x10025cee: `0x28 { keyword… }`; a missing 0x28 or `{` is error 5.
const readEntry = (reader: TokenReader): MaterialAnimationEntry => {
  if (reader.getNextToken() !== MaterialAnimationKeyword.KEYWORD_28)
    reader.fail(TokenReaderFailure.EXPECTED_LEFT_CURLY)
  if (reader.getNextToken() !== BinaryToken.LEFT_CURLY)
    reader.fail(TokenReaderFailure.EXPECTED_LEFT_CURLY)
  let firstValue: number = DEFAULT_KEYWORD_27_VALUES[0]
  let secondValue: number = DEFAULT_KEYWORD_27_VALUES[1]
  let keyword29Value = DEFAULT_KEYWORD_29_VALUE
  let keyword2aInteger = DEFAULT_KEYWORD_2A_INTEGER
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    if (keyword === MaterialAnimationKeyword.KEYWORD_27) {
      firstValue = reader.readInteger()
      secondValue = reader.readInteger()
    } else if (keyword === MaterialAnimationKeyword.KEYWORD_29) {
      keyword29Value = reader.readInteger()
    } else if (keyword === MaterialAnimationKeyword.KEYWORD_2A) {
      keyword2aInteger = reader.readInteger()
    } else {
      reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({
    keyword27Values: Object.freeze([
      getSignedShort(firstValue),
      getSignedShort(secondValue),
    ] as const),
    keyword29Value: getSignedShort(keyword29Value),
    keyword2aValue: getScaledValue(reader, keyword2aInteger),
  })
}

// 0x10025b60: `0x28 [ count ] { entry… }`.
const readEntries = (reader: TokenReader): readonly MaterialAnimationEntry[] => {
  if (reader.getNextToken() !== MaterialAnimationKeyword.KEYWORD_28)
    reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
  const count = readNonZeroCount(reader)
  const entries: MaterialAnimationEntry[] = []
  for (let index = 0; index < count; index++) entries.push(readEntry(reader))
  if (reader.getNextToken() !== BinaryToken.RIGHT_CURLY)
    reader.fail(TokenReaderFailure.EXPECTED_RIGHT_CURLY)
  return Object.freeze(entries)
}

// GolDP.dll 0x100258f0: the 0x27 section, then the 0x28 section; nothing after it is read.
export const parseMaterialAnimation = (bytes: Uint8Array): MaterialAnimation => {
  const reader = createTokenReader(bytes)
  const materials = readMaterials(reader)
  const entries = readEntries(reader)
  return Object.freeze({ materials, entries, readByteCount: reader.getPosition() })
}
