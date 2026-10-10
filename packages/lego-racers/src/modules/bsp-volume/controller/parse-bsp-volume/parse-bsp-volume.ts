import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import {
  getFixedPointValue,
  getSignedShort,
} from '../../../../shared/binary-values/binary-values.ts'
import {
  BspVolumeKeyword,
  CHILD_FFFE_INDEX,
  CHILD_FFFF_INDEX,
} from '../../types/bsp-volume-keyword/bsp-volume-keyword.ts'
import type {
  BspVolume,
  BspVolumeNode,
  BspVolumeShortQuadruple,
  BspVolumeVector,
} from '../../types/bsp-volume.types.ts'

const readNonZeroCount = (reader: TokenReader): number => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  return count
}

// 0x10025f90: `[ count ] { string… }`; the closing token must be `}` (error 6).
const readMaterialNames = (reader: TokenReader): readonly string[] => {
  const count = readNonZeroCount(reader)
  const names: string[] = []
  for (let index = 0; index < count >>> 0; index++) names.push(reader.readString())
  if (reader.getNextToken() !== BinaryToken.RIGHT_CURLY) {
    reader.fail(TokenReaderFailure.EXPECTED_RIGHT_CURLY)
  }
  return Object.freeze(names)
}

// 0x1002be90: the count is kept as a 16-bit word.
const readKeyword34Vectors = (reader: TokenReader): readonly BspVolumeVector[] => {
  const count = getSignedShort(reader.readArrayCount())
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const vectors: BspVolumeVector[] = []
  for (let index = 0; index < (count & 0xffff); index++) {
    const x = reader.readFloat()
    const y = reader.readFloat()
    const z = reader.readFloat()
    vectors.push(Object.freeze([x, y, z] as const))
  }
  reader.expectRightCurly()
  return Object.freeze(vectors)
}

// 0x1001bb10
const readKeyword2dEntries = (reader: TokenReader): readonly BspVolumeShortQuadruple[] => {
  const count = readNonZeroCount(reader)
  const entries: BspVolumeShortQuadruple[] = []
  for (let index = 0; index < count >>> 0; index++) {
    const first = getSignedShort(reader.readInteger())
    const second = getSignedShort(reader.readInteger())
    const third = getSignedShort(reader.readInteger())
    const fourth = getSignedShort(reader.readInteger())
    entries.push(Object.freeze([first, second, third, fourth] as const))
  }
  reader.expectRightCurly()
  return Object.freeze(entries)
}

// 0x1001bbb0: an int, or keyword 0x8c / 0x8d.
const readKeywordChild = (reader: TokenReader): number => {
  const token = reader.getNextToken()
  if (token === BinaryToken.INTEGER) return getSignedShort(reader.getIntegerValue())
  if (token === BspVolumeKeyword.CHILD_FFFF) return CHILD_FFFF_INDEX
  if (token === BspVolumeKeyword.CHILD_FFFE) return CHILD_FFFE_INDEX
  return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
}

// 0x1001bd00: an int, where only -1 and -2 may be negative.
const readIntegerChild = (reader: TokenReader): number => {
  const value = reader.readInteger()
  if (value === CHILD_FFFF_INDEX || value === CHILD_FFFE_INDEX) return value
  if (value < 0) reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  return getSignedShort(value)
}

const readShortValues = (reader: TokenReader): BspVolumeNode['shortValues'] => {
  const first = getSignedShort(reader.readInteger())
  const second = getSignedShort(reader.readInteger())
  return Object.freeze([first, second] as const)
}

// 0x1001bbb0: two children, four floats (the fourth is read and dropped), two int16.
const readFloatNode = (reader: TokenReader): BspVolumeNode => {
  const firstChild = readKeywordChild(reader)
  const secondChild = readKeywordChild(reader)
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  reader.readFloat()
  return Object.freeze({
    childIndices: Object.freeze([firstChild, secondChild] as const),
    vector: Object.freeze([x, y, z] as const),
    shortValues: readShortValues(reader),
  })
}

// 0x1001bd00: two children, three ints scaled by 2^-30 (0x10056c38), two int16.
const readFixedPointNode = (reader: TokenReader): BspVolumeNode => {
  const firstChild = readIntegerChild(reader)
  const secondChild = readIntegerChild(reader)
  const x = getFixedPointValue(reader.readInteger())
  const y = getFixedPointValue(reader.readInteger())
  const z = getFixedPointValue(reader.readInteger())
  return Object.freeze({
    childIndices: Object.freeze([firstChild, secondChild] as const),
    vector: Object.freeze([x, y, z] as const),
    shortValues: readShortValues(reader),
  })
}

const readNodes = (reader: TokenReader, isFixedPoint: boolean): readonly BspVolumeNode[] => {
  const count = readNonZeroCount(reader)
  const nodes: BspVolumeNode[] = []
  for (let index = 0; index < count >>> 0; index++) {
    nodes.push(isFixedPoint ? readFixedPointNode(reader) : readFloatNode(reader))
  }
  reader.expectRightCurly()
  return Object.freeze(nodes)
}

// GolDP.dll 0x1001b800: sections until the end of the file. 0x27 and 0x34 may appear once
// (error 18 otherwise); a repeated 0x2d, 0x8b or 0x8e replaces the earlier one.
export const parseBspVolume = (bytes: Uint8Array): BspVolume => {
  const reader = createTokenReader(bytes)
  let materialNames: readonly string[] | null = null
  let keyword34Vectors: readonly BspVolumeVector[] | null = null
  let keyword2dEntries: readonly BspVolumeShortQuadruple[] = Object.freeze([])
  let nodes: readonly BspVolumeNode[] = Object.freeze([])
  for (
    let token = reader.getNextToken();
    token !== BinaryToken.END_OF_FILE;
    token = reader.getNextToken()
  ) {
    switch (token) {
      case BspVolumeKeyword.MATERIAL_NAMES:
        if (materialNames !== null) reader.fail(TokenReaderFailure.UNEXPECTED_KEYWORD)
        materialNames = readMaterialNames(reader)
        break
      case BspVolumeKeyword.KEYWORD_34:
        if (keyword34Vectors !== null) reader.fail(TokenReaderFailure.UNEXPECTED_KEYWORD)
        keyword34Vectors = readKeyword34Vectors(reader)
        break
      case BspVolumeKeyword.KEYWORD_2D:
        keyword2dEntries = readKeyword2dEntries(reader)
        break
      case BspVolumeKeyword.FLOAT_NODES:
        nodes = readNodes(reader, false)
        break
      case BspVolumeKeyword.FIXED_POINT_NODES:
        nodes = readNodes(reader, true)
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({
    materialNames: materialNames ?? Object.freeze([]),
    keyword34Vectors: keyword34Vectors ?? Object.freeze([]),
    keyword2dEntries,
    nodes,
    readByteCount: reader.getPosition(),
  })
}
