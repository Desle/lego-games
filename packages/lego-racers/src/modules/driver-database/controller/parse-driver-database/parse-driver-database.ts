import {
  getUnsignedByte,
  getUnsignedShort,
} from '../../../../shared/binary-values/binary-values.ts'
import {
  readKeywordBlock,
  readNamedRecords,
  RECORD_NAME_MAXIMUM_LENGTH,
} from '../../../named-record/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { DriverKeyword } from '../../types/driver-keyword/driver-keyword.ts'
import type { Driver, DriverDatabase } from '../../types/driver-database.types.ts'

const PERSONALITY_KEYWORDS: readonly number[] = [
  DriverKeyword.PERSONALITY_FIRST,
  DriverKeyword.PERSONALITY_SECOND,
  DriverKeyword.PERSONALITY_THIRD,
  DriverKeyword.PERSONALITY_FOURTH,
  DriverKeyword.PERSONALITY_FIFTH,
  DriverKeyword.PERSONALITY_SIXTH,
]

const UNREAD_KEYWORDS: readonly number[] = [
  DriverKeyword.UNREAD_FIRST,
  DriverKeyword.UNREAD_SECOND,
  DriverKeyword.UNREAD_THIRD,
  DriverKeyword.UNREAD_FOURTH,
  DriverKeyword.UNREAD_FIFTH,
]

const createEmptyDriver = (name: string): Driver =>
  Object.freeze({
    name,
    nameStringIdentifier: 0,
    materialLibraryName: '',
    textureDatabaseName: '',
    modelName: '',
    championName: '',
    preferredPowerUpCode: 0,
    preferredPowerUpLevel: 0,
    personalityBytes: Object.freeze(PERSONALITY_KEYWORDS.map(() => 0)),
    voiceNumber: 0,
    unreadBytes: Object.freeze(UNREAD_KEYWORDS.map(() => 0)),
  })

const getWithByte = (bytes: readonly number[], index: number, value: number): readonly number[] =>
  Object.freeze(bytes.map((byte, position) => (position === index ? value : byte)))

const readName = (reader: TokenReader) =>
  reader.readStringWithMaximumLength(RECORD_NAME_MAXIMUM_LENGTH)

const applyKeyword = (reader: TokenReader, keyword: number, driver: Driver): Driver | null => {
  switch (keyword) {
    case DriverKeyword.MATERIAL_LIBRARY:
      return Object.freeze({ ...driver, materialLibraryName: readName(reader) })
    case DriverKeyword.TEXTURE_DATABASE:
      return Object.freeze({ ...driver, textureDatabaseName: readName(reader) })
    case DriverKeyword.MODEL:
      return Object.freeze({ ...driver, modelName: readName(reader) })
    case DriverKeyword.CHAMPION:
      return Object.freeze({ ...driver, championName: readName(reader) })
    case DriverKeyword.NAME_STRING_IDENTIFIER:
      return Object.freeze({
        ...driver,
        nameStringIdentifier: getUnsignedShort(reader.readInteger()),
      })
    case DriverKeyword.VOICE_NUMBER:
      return Object.freeze({ ...driver, voiceNumber: getUnsignedByte(reader.readInteger()) })
    case DriverKeyword.PREFERRED_POWER_UP: {
      const preferredPowerUpCode = getUnsignedByte(reader.readInteger())
      const preferredPowerUpLevel = getUnsignedByte(reader.readInteger())
      return Object.freeze({ ...driver, preferredPowerUpCode, preferredPowerUpLevel })
    }
    default: {
      const personalityIndex = PERSONALITY_KEYWORDS.indexOf(keyword)
      if (personalityIndex >= 0) {
        const value = getUnsignedByte(reader.readInteger())
        return Object.freeze({
          ...driver,
          personalityBytes: getWithByte(driver.personalityBytes, personalityIndex, value),
        })
      }
      const unreadIndex = UNREAD_KEYWORDS.indexOf(keyword)
      if (unreadIndex < 0) return null
      const value = getUnsignedByte(reader.readInteger())
      return Object.freeze({
        ...driver,
        unreadBytes: getWithByte(driver.unreadBytes, unreadIndex, value),
      })
    }
  }
}

// LEGORacers.exe 0x004208f0: `0x27 [ count ] { (0x27 name { keywords }) * count }`.
export const parseDriverDatabase = (bytes: Uint8Array): DriverDatabase => {
  const { records, readByteCount } = readNamedRecords(bytes, (reader, name) =>
    readKeywordBlock(reader, createEmptyDriver(name), (keyword, driver) =>
      applyKeyword(reader, keyword, driver)
    )
  )
  return Object.freeze({ drivers: records, readByteCount })
}
