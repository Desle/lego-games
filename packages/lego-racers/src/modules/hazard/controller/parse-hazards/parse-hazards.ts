import { readFloatTriple } from '../../../token-reader/index.ts'
import { UnportableFileError } from '../../../../shared/errors/gol-file-errors.ts'
import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  HAZARDS_WITHOUT_DATA,
  HazardBlockKeyword,
  HazardKeyword,
  MAXIMUM_NAME_COUNT,
  NAME_MAXIMUM_LENGTH,
} from '../../types/hazard-keyword/hazard-keyword.ts'
import type {
  CannonBlock,
  Hazard,
  Hazard34,
  Hazard3D,
  Hazard40,
  Hazard43,
  Hazard48,
  HazardList,
  HazardPoint,
  Vector3,
} from '../../types/hazard.types.ts'

const readName = (reader: TokenReader) => reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH)

const negateY = (vector: Vector3 | null): Vector3 | null =>
  vector === null ? null : Object.freeze([vector[0], -vector[1], vector[2]] as const)

// Reads `{ keyword ... }`, handing every keyword to applyKeyword; unknown ones are syntax errors.
const readBlock = <Value>(
  reader: TokenReader,
  initial: Value,
  applyKeyword: (keyword: number, value: Value) => Value | null
): Value => {
  reader.expectLeftCurly()
  let value = initial
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    value = applyKeyword(keyword, value) ?? reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
  return value
}

// 0x0048f830: a mirrored track negates the y of the three vectors after the block.
const readCannonBlock = (reader: TokenReader, isMirrored: boolean): CannonBlock => {
  const block = readBlock<CannonBlock>(
    reader,
    { firstVector: null, secondVector: null, thirdVector: null, squaredFloat: null, integer: null },
    (keyword, value) => {
      switch (keyword) {
        case HazardBlockKeyword.FIRST_VECTOR:
          return { ...value, firstVector: readFloatTriple(reader) }
        case HazardBlockKeyword.SECOND_VECTOR:
          return { ...value, secondVector: readFloatTriple(reader) }
        case HazardBlockKeyword.THIRD_VECTOR:
          return { ...value, thirdVector: readFloatTriple(reader) }
        case HazardBlockKeyword.SQUARED_FLOAT: {
          const float = reader.readFloat()
          return { ...value, squaredFloat: Math.fround(float * float) }
        }
        case HazardBlockKeyword.INTEGER:
          return { ...value, integer: reader.readInteger() }
        default:
          return null
      }
    }
  )
  if (!isMirrored) return Object.freeze(block)
  return Object.freeze({
    ...block,
    firstVector: negateY(block.firstVector),
    secondVector: negateY(block.secondVector),
    thirdVector: negateY(block.thirdVector),
  })
}

// 0x0048ee00: more than four 0x42 names overrun its stack buffer.
const readHazard34 = (reader: TokenReader): Hazard34 => {
  const hazard = readBlock<Hazard34>(
    reader,
    { keyword: 0x34, integer: null, objectName: null, names: Object.freeze([]) },
    (keyword, value) => {
      switch (keyword) {
        case HazardBlockKeyword.INTEGER:
          return { ...value, integer: reader.readInteger() }
        case HazardBlockKeyword.OBJECT_NAME:
          return { ...value, objectName: readName(reader) }
        case HazardBlockKeyword.NAME: {
          const names = Object.freeze([...value.names, readName(reader)])
          if (names.length > MAXIMUM_NAME_COUNT) {
            throw new UnportableFileError(
              'More than four names overrun the original buffer',
              reader.getPosition()
            )
          }
          return { ...value, names }
        }
        default:
          return null
      }
    }
  )
  return Object.freeze(hazard)
}

// 0x0048f2b0: `[ count ]` with the bracket helpers, `{`, count points of three floats and an integer, `}`.
const readPoints = (reader: TokenReader, isMirrored: boolean): readonly HazardPoint[] => {
  reader.expectLeftBracket()
  const count = reader.readInteger() >>> 0
  reader.expectRightBracket()
  reader.expectLeftCurly()
  const points = Array.from({ length: count }, () => {
    const position = readFloatTriple(reader)
    const integer = reader.readInteger()
    return Object.freeze({
      position: isMirrored ? (negateY(position) ?? position) : position,
      integer,
    })
  })
  reader.expectRightCurly()
  return Object.freeze(points)
}

// 0x0048f2b0: point lists until 0x33, whose block ends the hazard with `}`; other tokens are skipped.
const readHazard3D = (reader: TokenReader, isMirrored: boolean): Hazard3D => {
  reader.expectLeftCurly()
  let points: readonly HazardPoint[] | null = null
  let secondPoints: readonly HazardPoint[] | null = null
  for (
    let keyword = reader.getNextToken();
    keyword !== HazardKeyword.HAZARD_33;
    keyword = reader.getNextToken()
  ) {
    if (keyword === BinaryToken.END_OF_FILE) {
      throw new UnportableFileError(
        'The original loops forever at the end of the file',
        reader.getPosition()
      )
    }
    if (keyword === HazardBlockKeyword.POINT_LIST) points = readPoints(reader, isMirrored)
    else if (keyword === HazardBlockKeyword.SECOND_POINT_LIST) {
      secondPoints = readPoints(reader, isMirrored)
    }
  }
  const block = readCannonBlock(reader, isMirrored)
  reader.expectRightCurly()
  return Object.freeze({ keyword: 0x3d, points, secondPoints, block })
}

const readHazard40 = (reader: TokenReader, isMirrored: boolean): Hazard40 =>
  Object.freeze(
    readBlock<Hazard40>(
      reader,
      {
        keyword: 0x40,
        vector: null,
        integer: null,
        name: null,
        secondInteger: null,
        secondVector: null,
      },
      (keyword, value) => {
        switch (keyword) {
          case HazardBlockKeyword.FIRST_VECTOR: {
            const vector = readFloatTriple(reader)
            return { ...value, vector: isMirrored ? negateY(vector) : vector }
          }
          case HazardBlockKeyword.INTEGER:
            return { ...value, integer: reader.readInteger() }
          case HazardBlockKeyword.NAME:
            return { ...value, name: readName(reader) }
          case HazardBlockKeyword.SECOND_INTEGER_46:
            return { ...value, secondInteger: reader.readInteger() }
          case HazardBlockKeyword.SECOND_VECTOR_47:
            return { ...value, secondVector: readFloatTriple(reader) }
          default:
            return null
        }
      }
    )
  )

const readHazard43 = (reader: TokenReader): Hazard43 =>
  Object.freeze(
    readBlock<Hazard43>(
      reader,
      { keyword: 0x43, integer: null, name: null, secondInteger: null, secondName: null },
      (keyword, value) => {
        switch (keyword) {
          case HazardBlockKeyword.INTEGER:
            return { ...value, integer: reader.readInteger() }
          case HazardBlockKeyword.NAME:
            return { ...value, name: readName(reader) }
          case HazardBlockKeyword.SECOND_INTEGER_44:
            return { ...value, secondInteger: reader.readInteger() }
          case HazardBlockKeyword.SECOND_NAME:
            return { ...value, secondName: readName(reader) }
          default:
            return null
        }
      }
    )
  )

// 0x0048de10: the name is followed by three floats, stored at +0x50, +0x48 and +0x4c.
const readHazard48 = (reader: TokenReader): Hazard48 =>
  Object.freeze(
    readBlock<Hazard48>(
      reader,
      { keyword: 0x48, integer: null, name: null, vector: null },
      (keyword, value) => {
        switch (keyword) {
          case HazardBlockKeyword.INTEGER:
            return { ...value, integer: reader.readInteger() }
          case HazardBlockKeyword.NAME: {
            const name = readName(reader)
            return { ...value, name, vector: readFloatTriple(reader) }
          }
          default:
            return null
        }
      }
    )
  )

const readHazard = (reader: TokenReader, isMirrored: boolean): Hazard => {
  const keyword = reader.getNextToken()
  if (HAZARDS_WITHOUT_DATA.has(keyword)) return Object.freeze({ keyword })
  switch (keyword) {
    case HazardKeyword.HAZARD_33:
      return Object.freeze({ keyword: 0x33, ...readCannonBlock(reader, isMirrored) })
    case HazardKeyword.HAZARD_34:
      return readHazard34(reader)
    case HazardKeyword.HAZARD_36: {
      const name = readName(reader)
      const firstFloat = reader.readFloat()
      const secondFloat = reader.readFloat()
      return Object.freeze({ keyword: 0x36, name, firstFloat, secondFloat })
    }
    case HazardKeyword.HAZARD_3D:
      return readHazard3D(reader, isMirrored)
    case HazardKeyword.HAZARD_3E: {
      reader.expectLeftCurly()
      const name = readName(reader)
      const integer = reader.readInteger()
      const float = reader.readFloat()
      const vector = readFloatTriple(reader)
      reader.expectRightCurly()
      return Object.freeze({ keyword: 0x3e, name, integer, float, vector })
    }
    case HazardKeyword.HAZARD_40:
      return readHazard40(reader, isMirrored)
    case HazardKeyword.HAZARD_43:
      return readHazard43(reader)
    case HazardKeyword.HAZARD_48:
      return readHazard48(reader)
    default:
      throw new UnportableFileError(
        `Hazard keyword 0x${keyword.toString(16)} calls through a null object in the original`,
        reader.getPosition()
      )
  }
}

// LEGORacers.exe 0x0048a4d0: `0x27 [ count ]`, and for a non-zero count `{ hazard * count }`.
export const parseHazards = (bytes: Uint8Array, isMirrored: boolean): HazardList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(HazardKeyword.HAZARDS)
  const count = reader.readArrayCount() >>> 0
  if (count === 0)
    return Object.freeze({ hazards: Object.freeze([]), readByteCount: reader.getPosition() })
  const hazards = Array.from({ length: count }, () => readHazard(reader, isMirrored))
  reader.expectRightCurly()
  return Object.freeze({ hazards: Object.freeze(hazards), readByteCount: reader.getPosition() })
}
