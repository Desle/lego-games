import { readFloatTriple } from '../../../token-reader/index.ts'
import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import { EmitterKeyword, NAME_MAXIMUM_LENGTH } from '../../types/emitter-keyword/emitter-keyword.ts'
import type { Emitter, EmitterList, Vector3 } from '../../types/emitter.types.ts'

// 0x0048a1b8: the period is `1000 / rate` (0x004af670) and 0x0048a1d2: the chance a byte, `fraction · 256` (0x004b40c0).
const BIRTHS_PER_SECOND_NUMERATOR = 1000
const CHANCE_SCALE = 256

const INTEGER_INDEFINITE = -0x80000000

// MSVCRT _ftol truncates toward zero; out-of-range values give the integer indefinite.
const truncateToInteger = (value: number): number => {
  const truncated = Math.trunc(value)
  return truncated >= -0x80000000 && truncated <= 0x7fffffff ? truncated : INTEGER_INDEFINITE
}

// Keyword 0x2b of 0x0048a130: `[ count ] {` and count points of three floats, then `}`.
const readPoints = (reader: TokenReader): readonly Vector3[] => {
  reader.expectLeftBracket()
  const count = reader.readInteger() >>> 0
  reader.expectRightBracket()
  reader.expectLeftCurly()
  const points = Array.from({ length: count }, () => readFloatTriple(reader))
  reader.expectRightCurly()
  return Object.freeze(points)
}

const applyKeyword = (reader: TokenReader, keyword: number, emitter: Emitter): Emitter => {
  switch (keyword) {
    case EmitterKeyword.FIRST_TRUNCATED_VALUE:
      return {
        ...emitter,
        firstTruncatedValue: truncateToInteger(
          Math.fround(BIRTHS_PER_SECOND_NUMERATOR / reader.readFloat())
        ),
      }
    case EmitterKeyword.SECOND_TRUNCATED_VALUE:
      return {
        ...emitter,
        secondTruncatedValue: truncateToInteger(reader.readFloat() * CHANCE_SCALE) & 0xff,
      }
    case EmitterKeyword.VECTOR:
      return { ...emitter, vector: readFloatTriple(reader) }
    case EmitterKeyword.POINTS:
      return { ...emitter, points: readPoints(reader) }
    case EmitterKeyword.FIRST_FLOAT:
      return { ...emitter, firstFloat: reader.readFloat() }
    case EmitterKeyword.SECOND_FLOAT:
      return { ...emitter, secondFloat: reader.readFloat() }
    case EmitterKeyword.ENTRY_INDEX:
      return { ...emitter, entryIndex: reader.readInteger() }
    case EmitterKeyword.FIRST_INTEGER:
      return { ...emitter, firstInteger: reader.readInteger() }
    case EmitterKeyword.SECOND_INTEGER:
      return { ...emitter, secondInteger: reader.readInteger() }
    case EmitterKeyword.THIRD_FLOAT:
      return { ...emitter, thirdFloat: reader.readFloat() }
    case EmitterKeyword.FOURTH_FLOAT:
      return { ...emitter, fourthFloat: reader.readFloat() }
    case EmitterKeyword.FIFTH_FLOAT:
      return { ...emitter, fifthFloat: reader.readFloat() }
    case EmitterKeyword.LINKED_NAME:
      return { ...emitter, linkedName: reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH) }
    case EmitterKeyword.THIRD_INTEGER:
      return { ...emitter, thirdInteger: reader.readInteger() & 0xff }
    default:
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
}

const readEmitter = (reader: TokenReader): Emitter => {
  reader.expectToken(EmitterKeyword.EMITTER)
  let emitter: Emitter = {
    name: reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH),
    firstTruncatedValue: 0,
    secondTruncatedValue: 0,
    vector: Object.freeze([0, 0, 0] as const),
    points: Object.freeze([]),
    firstFloat: 1,
    secondFloat: 1,
    thirdFloat: 0,
    fourthFloat: 0,
    fifthFloat: 0,
    entryIndex: null,
    firstInteger: 0,
    secondInteger: -1,
    thirdInteger: 0,
    linkedName: null,
  }
  reader.expectLeftCurly()
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    emitter = applyKeyword(reader, keyword, emitter)
  }
  return Object.freeze(emitter)
}

// LEGORacers.exe 0x00489af0: `0x27 [ count ] {`, and for a non-zero count the blocks and `}`.
export const parseEmitters = (bytes: Uint8Array): EmitterList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(EmitterKeyword.EMITTER)
  const count = reader.readArrayCount() >>> 0
  const emitters = Array.from({ length: count }, () => readEmitter(reader))
  if (count !== 0) reader.expectRightCurly()
  return Object.freeze({ emitters: Object.freeze(emitters), readByteCount: reader.getPosition() })
}
