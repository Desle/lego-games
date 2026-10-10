import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import {
  getSignedShort,
  getThousandthOf,
  getUnsignedShort,
} from '../../../../shared/binary-values/binary-values.ts'
import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import { createNameTable } from '../../../../shared/name-table/name-table.ts'
import type { NameTable } from '../../../../shared/name-table/name-table.types.ts'
import {
  AnimationKeyword,
  KEYWORD_31_DEFAULT_FOURTH_VALUE,
} from '../../types/animation-keyword/animation-keyword.ts'
import type {
  Animation,
  AnimationKeyword2bEntry,
  AnimationKeyword2cEntry,
  AnimationQuadruple,
  AnimationTriple,
} from '../../types/animation.types.ts'

const readNonZeroCount = (reader: TokenReader): number => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  return count >>> 0
}

const readTriple = (reader: TokenReader): AnimationTriple => {
  const first = reader.readFloat()
  const second = reader.readFloat()
  const third = reader.readFloat()
  return Object.freeze([first, second, third] as const)
}

const readQuadruple = (reader: TokenReader): AnimationQuadruple => {
  const first = reader.readFloat()
  const second = reader.readFloat()
  const third = reader.readFloat()
  const fourth = reader.readFloat()
  return Object.freeze([first, second, third, fourth] as const)
}

const readList = <Entry>(reader: TokenReader, readEntry: () => Entry): readonly Entry[] => {
  const count = readNonZeroCount(reader)
  const entries: Entry[] = []
  for (let index = 0; index < count; index++) entries.push(readEntry())
  reader.expectRightCurly()
  return Object.freeze(entries)
}

const readKeyword2bEntry = (reader: TokenReader): AnimationKeyword2bEntry => {
  const first = reader.readInteger()
  const second = reader.readInteger()
  const third = getSignedShort(reader.readInteger())
  const fourth = reader.readInteger()
  const fifth = reader.readInteger()
  const sixth = getSignedShort(reader.readInteger())
  return Object.freeze([first, second, third, fourth, fifth, sixth] as const)
}

// 0x10018670 for keywords 0x2d and 0x2e: the next token must be an int (error 4).
const readIntegerToken = (reader: TokenReader): number => {
  if (reader.getNextToken() !== BinaryToken.INTEGER) {
    reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  }
  return reader.getIntegerValue()
}

const readKeyword2fValue = (reader: TokenReader): number => {
  const value = getThousandthOf(reader.readInteger())
  if (value === null) {
    throw new UnportableFileError(
      'Keyword 0x2f value too large to scale exactly',
      reader.getPosition()
    )
  }
  return value
}

// 0x10018b40 → 0x10018670: `0x2c "name" { keyword... }`.
const readKeyword2cEntry = (
  reader: TokenReader,
  names: NameTable,
  index: number
): AnimationKeyword2cEntry => {
  if (reader.getNextToken() !== AnimationKeyword.KEYWORD_2C) {
    reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
  }
  const name = reader.readString()
  names.add(name, index)
  reader.expectLeftCurly()

  let keyword2fValue = 0
  let keyword30Values: AnimationTriple = Object.freeze([0, 0, 0] as const)
  let keyword31Values: AnimationQuadruple = Object.freeze([
    0,
    0,
    0,
    KEYWORD_31_DEFAULT_FOURTH_VALUE,
  ] as const)
  let keyword2bValue = 0
  let keyword2dValue = 0
  let keyword2eValue = 0
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case AnimationKeyword.KEYWORD_2B:
        keyword2bValue = reader.readInteger()
        break
      case AnimationKeyword.KEYWORD_2D:
        keyword2dValue = getSignedShort(readIntegerToken(reader))
        break
      case AnimationKeyword.KEYWORD_2E:
        keyword2eValue = getUnsignedShort(readIntegerToken(reader))
        break
      case AnimationKeyword.KEYWORD_2F:
        keyword2fValue = readKeyword2fValue(reader)
        break
      case AnimationKeyword.KEYWORD_30:
        keyword30Values = readTriple(reader)
        break
      case AnimationKeyword.KEYWORD_31:
        keyword31Values = readQuadruple(reader)
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }

  return Object.freeze({
    name,
    keyword2fValue,
    keyword30Values,
    keyword31Values,
    keyword2bValue,
    keyword2dValue,
    keyword2eValue,
  })
}

// 0x10018b40: `[ count ] { entry... }` with a fresh name table.
const readKeyword2cEntries = (reader: TokenReader): readonly AnimationKeyword2cEntry[] => {
  const count = readNonZeroCount(reader)
  const names = createNameTable()
  const entries: AnimationKeyword2cEntry[] = []
  for (let index = 0; index < count; index++) {
    entries.push(readKeyword2cEntry(reader, names, index))
  }
  reader.expectRightCurly()
  return Object.freeze(entries)
}

const EMPTY: readonly never[] = Object.freeze([])

// GolDP.dll 0x100188e0: sections until the end of the file; each list keeps the last one read.
export const parseAnimation = (bytes: Uint8Array): Animation => {
  const reader = createTokenReader(bytes)
  let keyword28Triples: readonly AnimationTriple[] = EMPTY
  let keyword29Quadruples: readonly AnimationQuadruple[] = EMPTY
  let keyword2aValues: readonly number[] = EMPTY
  let keyword2bEntries: readonly AnimationKeyword2bEntry[] = EMPTY
  let keyword2cEntries: readonly AnimationKeyword2cEntry[] = EMPTY

  // 0x100241d0: `{ (0x28 | 0x29 | 0x2a) [ count ] { … } … }`.
  const readKeyword27Block = (): void => {
    reader.expectLeftCurly()
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      if (keyword === AnimationKeyword.KEYWORD_28) {
        keyword28Triples = readList(reader, () => readTriple(reader))
      } else if (keyword === AnimationKeyword.KEYWORD_29) {
        keyword29Quadruples = readList(reader, () => readQuadruple(reader))
      } else if (keyword === AnimationKeyword.KEYWORD_2A) {
        keyword2aValues = readList(reader, () => getSignedShort(reader.readInteger()))
      } else {
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      }
    }
  }

  for (
    let token = reader.getNextToken();
    token !== BinaryToken.END_OF_FILE;
    token = reader.getNextToken()
  ) {
    if (token === AnimationKeyword.KEYWORD_27) {
      readKeyword27Block()
    } else if (token === AnimationKeyword.KEYWORD_2B) {
      keyword2bEntries = readList(reader, () => readKeyword2bEntry(reader))
    } else if (token === AnimationKeyword.KEYWORD_2C) {
      keyword2cEntries = readKeyword2cEntries(reader)
    } else {
      reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }

  return Object.freeze({
    keyword28Triples,
    keyword29Quadruples,
    keyword2aValues,
    keyword2bEntries,
    keyword2cEntries,
    readByteCount: reader.getPosition(),
  })
}
