import { getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import {
  readKeywordBlock,
  readNamedRecords,
  RECORD_NAME_MAXIMUM_LENGTH,
} from '../../../named-record/index.ts'
import { BinaryToken, readFloatTriple } from '../../../token-reader/index.ts'
import type { FloatTriple, TokenReader } from '../../../token-reader/index.ts'
import {
  CHASSIS_POINT_COUNT,
  CHASSIS_VARIANT_COUNT,
  ChassisKeyword,
  ChassisVariantKeyword,
  DEFAULT_STEERING_RATING,
  DEFAULT_THROTTLE_RATING,
  DEFAULT_TOP_SPEED_RATING,
} from '../../types/chassis-keyword/chassis-keyword.ts'
import type {
  Chassis,
  ChassisDatabase,
  ChassisVariant,
} from '../../types/chassis-database.types.ts'

const ZERO_TRIPLE: FloatTriple = Object.freeze([0, 0, 0] as const)

const createEmptyVariant = (): ChassisVariant =>
  Object.freeze({
    materialLibraryName: '',
    textureDatabaseName: '',
    modelName: '',
    skeletonName: '',
    animationName: '',
  })

const createEmptyChassis = (name: string): Chassis =>
  Object.freeze({
    name,
    variants: Object.freeze(Array.from({ length: CHASSIS_VARIANT_COUNT }, createEmptyVariant)),
    sharedResourceName: '',
    builtCentreOfMassBase: ZERO_TRIPLE,
    vehiclePoint: ZERO_TRIPLE,
    baseMass: 0,
    unreadPair: Object.freeze([0, 0] as const),
    hullExtents: Object.freeze([0, 0] as const),
    racerValue: 0,
    vehicleValues: Object.freeze([0, 0] as const),
    vehiclePoints: Object.freeze(Array.from({ length: CHASSIS_POINT_COUNT }, () => ZERO_TRIPLE)),
    wheelPoints: Object.freeze(Array.from({ length: CHASSIS_POINT_COUNT }, () => ZERO_TRIPLE)),
    unreadIntegers: Object.freeze([0, 0] as const),
    steeringRating: DEFAULT_STEERING_RATING,
    throttleRating: DEFAULT_THROTTLE_RATING,
    topSpeedRating: DEFAULT_TOP_SPEED_RATING,
  })

const readName = (reader: TokenReader) =>
  reader.readStringWithMaximumLength(RECORD_NAME_MAXIMUM_LENGTH)

// FUN_0041e210 (0x0041e210): the block after keyword 0x28 or 0x29. A keyword it does not know is skipped without
// reading a value, unlike the record's own keywords.
const readVariant = (reader: TokenReader): ChassisVariant => {
  reader.expectLeftCurly()
  let variant = createEmptyVariant()
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case ChassisVariantKeyword.MATERIAL_LIBRARY:
        variant = Object.freeze({ ...variant, materialLibraryName: readName(reader) })
        break
      case ChassisVariantKeyword.TEXTURE_DATABASE:
        variant = Object.freeze({ ...variant, textureDatabaseName: readName(reader) })
        break
      case ChassisVariantKeyword.MODEL:
        variant = Object.freeze({ ...variant, modelName: readName(reader) })
        break
      case ChassisVariantKeyword.SKELETON:
        variant = Object.freeze({ ...variant, skeletonName: readName(reader) })
        break
      case ChassisVariantKeyword.ANIMATION:
        variant = Object.freeze({ ...variant, animationName: readName(reader) })
        break
      default:
        break
    }
  }
  return variant
}

const readFloatPair = (reader: TokenReader): readonly [number, number] => {
  const first = reader.readFloat()
  const second = reader.readFloat()
  return Object.freeze([first, second] as const)
}

const readPoints = (reader: TokenReader): readonly FloatTriple[] =>
  Object.freeze(Array.from({ length: CHASSIS_POINT_COUNT }, () => readFloatTriple(reader)))

const getWithVariant = (
  chassis: Chassis,
  index: number,
  variant: ChassisVariant
): readonly ChassisVariant[] =>
  Object.freeze(
    chassis.variants.map((current, position) => (position === index ? variant : current))
  )

const applyKeyword = (reader: TokenReader, keyword: number, chassis: Chassis): Chassis | null => {
  switch (keyword) {
    case ChassisKeyword.FIRST_VARIANT:
      return Object.freeze({
        ...chassis,
        variants: getWithVariant(chassis, 0, readVariant(reader)),
      })
    case ChassisKeyword.SECOND_VARIANT:
      return Object.freeze({
        ...chassis,
        variants: getWithVariant(chassis, 1, readVariant(reader)),
      })
    case ChassisKeyword.BUILT_CENTRE_OF_MASS_BASE:
      return Object.freeze({ ...chassis, builtCentreOfMassBase: readFloatTriple(reader) })
    case ChassisKeyword.VEHICLE_POINT:
      return Object.freeze({ ...chassis, vehiclePoint: readFloatTriple(reader) })
    case ChassisKeyword.BASE_MASS:
      return Object.freeze({ ...chassis, baseMass: reader.readFloat() })
    case ChassisKeyword.UNREAD_PAIR:
      return Object.freeze({ ...chassis, unreadPair: readFloatPair(reader) })
    case ChassisKeyword.HULL_EXTENTS:
      return Object.freeze({ ...chassis, hullExtents: readFloatPair(reader) })
    case ChassisKeyword.RACER_VALUE:
      return Object.freeze({ ...chassis, racerValue: reader.readFloat() })
    case ChassisKeyword.VEHICLE_BLOCK: {
      reader.expectLeftCurly()
      const vehicleValues = readFloatPair(reader)
      const vehiclePoints = readPoints(reader)
      reader.expectRightCurly()
      return Object.freeze({ ...chassis, vehicleValues, vehiclePoints })
    }
    case ChassisKeyword.WHEEL_BLOCK: {
      reader.expectLeftCurly()
      const wheelPoints = readPoints(reader)
      reader.expectRightCurly()
      return Object.freeze({ ...chassis, wheelPoints })
    }
    case ChassisKeyword.FIRST_UNREAD_INTEGER:
      return Object.freeze({
        ...chassis,
        unreadIntegers: Object.freeze([reader.readInteger(), chassis.unreadIntegers[1]] as const),
      })
    case ChassisKeyword.SECOND_UNREAD_INTEGER:
      return Object.freeze({
        ...chassis,
        unreadIntegers: Object.freeze([chassis.unreadIntegers[0], reader.readInteger()] as const),
      })
    case ChassisKeyword.SHARED_RESOURCE_NAME:
      return Object.freeze({ ...chassis, sharedResourceName: readName(reader) })
    case ChassisKeyword.STEERING_RATING:
      return Object.freeze({ ...chassis, steeringRating: getUnsignedByte(reader.readInteger()) })
    case ChassisKeyword.THROTTLE_RATING:
      return Object.freeze({ ...chassis, throttleRating: getUnsignedByte(reader.readInteger()) })
    case ChassisKeyword.TOP_SPEED_RATING:
      return Object.freeze({ ...chassis, topSpeedRating: getUnsignedByte(reader.readInteger()) })
    default:
      return null
  }
}

// LEGORacers.exe 0x0041db10: `0x27 [ count ] { (0x27 name { keywords }) * count }`.
export const parseChassisDatabase = (bytes: Uint8Array): ChassisDatabase => {
  const { records, readByteCount } = readNamedRecords(bytes, (reader, name) =>
    readKeywordBlock(reader, createEmptyChassis(name), (keyword, chassis) =>
      applyKeyword(reader, keyword, chassis)
    )
  )
  return Object.freeze({ chassis: records, readByteCount })
}
