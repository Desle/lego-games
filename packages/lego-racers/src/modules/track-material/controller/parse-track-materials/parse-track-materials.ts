import { readFloatTriple } from '../../../token-reader/index.ts'
import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  LOADED_FLAG,
  NAME_MAXIMUM_LENGTH,
  TrackMaterialKeyword,
} from '../../types/track-material-keyword/track-material-keyword.ts'
import type { TrackMaterial, TrackMaterialList, Vector3 } from '../../types/track-material.types.ts'

const ZERO_VECTOR: Vector3 = Object.freeze([0, 0, 0] as const)

const INTEGER_FIELDS: ReadonlyMap<number, readonly [keyof TrackMaterial, number]> = new Map([
  [TrackMaterialKeyword.FIRST_INTEGER, ['firstInteger', 0x2]],
  [TrackMaterialKeyword.SECOND_INTEGER, ['secondInteger', 0x4]],
  [TrackMaterialKeyword.THIRD_INTEGER, ['thirdInteger', 0x8]],
  [TrackMaterialKeyword.FOURTH_INTEGER, ['fourthInteger', 0x10]],
  [TrackMaterialKeyword.FIFTH_INTEGER, ['fifthInteger', 0x80]],
  [TrackMaterialKeyword.SIXTH_INTEGER, ['sixthInteger', 0x100]],
  [TrackMaterialKeyword.SEVENTH_INTEGER, ['seventhInteger', 0x200]],
])

const FLOAT_FIELDS: ReadonlyMap<number, readonly [keyof TrackMaterial, number]> = new Map([
  [TrackMaterialKeyword.FIRST_FLOAT, ['firstFloat', 0x800]],
  [TrackMaterialKeyword.SECOND_FLOAT, ['secondFloat', 0x1000]],
  [TrackMaterialKeyword.THIRD_FLOAT, ['thirdFloat', 0x2000]],
  [TrackMaterialKeyword.FOURTH_FLOAT, ['fourthFloat', 0x4000]],
  [TrackMaterialKeyword.FIFTH_FLOAT, ['fifthFloat', 0x8000]],
])

const FLAG_ONLY_BITS: ReadonlyMap<number, number> = new Map([
  [TrackMaterialKeyword.FLAG_10000, 0x10000],
  [TrackMaterialKeyword.FLAG_20000, 0x20000],
  [TrackMaterialKeyword.FLAG_40000, 0x40000],
])

const applyKeyword = (
  reader: TokenReader,
  keyword: number,
  material: TrackMaterial,
  isMirrored: boolean
): TrackMaterial => {
  const addFlag = (bit: number) => (material.flags | bit) >>> 0
  const integerField = INTEGER_FIELDS.get(keyword)
  if (integerField !== undefined) {
    const [field, bit] = integerField
    return { ...material, [field]: reader.readInteger(), flags: addFlag(bit) }
  }
  const floatField = FLOAT_FIELDS.get(keyword)
  if (floatField !== undefined) {
    const [field, bit] = floatField
    return { ...material, [field]: reader.readFloat(), flags: addFlag(bit) }
  }
  const flagOnlyBit = FLAG_ONLY_BITS.get(keyword)
  if (flagOnlyBit !== undefined) return { ...material, flags: addFlag(flagOnlyBit) }
  switch (keyword) {
    case TrackMaterialKeyword.FIRST_VECTOR:
      return { ...material, firstVector: readFloatTriple(reader, isMirrored), flags: addFlag(0x20) }
    case TrackMaterialKeyword.SECOND_VECTOR:
      return {
        ...material,
        secondVector: readFloatTriple(reader, isMirrored),
        flags: addFlag(0x40),
      }
    case TrackMaterialKeyword.LINKED_NAME:
      return {
        ...material,
        linkedName: reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH),
        flags: addFlag(0x400),
      }
    default:
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
}

const readTrackMaterial = (reader: TokenReader, isMirrored: boolean): TrackMaterial => {
  reader.expectToken(TrackMaterialKeyword.TRACK_MATERIAL)
  let material: TrackMaterial = {
    name: reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH),
    flags: 0,
    firstInteger: 0,
    secondInteger: 0,
    thirdInteger: 0,
    fourthInteger: 0,
    firstVector: ZERO_VECTOR,
    secondVector: ZERO_VECTOR,
    fifthInteger: 0,
    sixthInteger: 0,
    seventhInteger: 0,
    linkedName: null,
    firstFloat: 0,
    secondFloat: 0,
    thirdFloat: 0,
    fourthFloat: 0,
    fifthFloat: 0,
  }
  reader.expectLeftCurly()
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    material = applyKeyword(reader, keyword, material, isMirrored)
  }
  return Object.freeze({ ...material, flags: (material.flags | LOADED_FLAG) >>> 0 })
}

// LEGORacers.exe 0x00444030: `0x27 [ count ] { (0x27 "name" { keywords }) * count }`.
export const parseTrackMaterials = (bytes: Uint8Array, isMirrored: boolean): TrackMaterialList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(TrackMaterialKeyword.TRACK_MATERIAL)
  const count = reader.readArrayCount() >>> 0
  const trackMaterials = Array.from({ length: count }, () => readTrackMaterial(reader, isMirrored))
  reader.expectRightCurly()
  return Object.freeze({
    trackMaterials: Object.freeze(trackMaterials),
    readByteCount: reader.getPosition(),
  })
}
