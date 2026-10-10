import {
  readKeywordBlock,
  readNamedRecords,
  RECORD_NAME_MAXIMUM_LENGTH,
} from '../../../named-record/index.ts'
import { readFloatTriple } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { ChampionKeyword } from '../../types/champion-keyword/champion-keyword.ts'
import type { Champion, ChampionDatabase } from '../../types/champion-database.types.ts'

const createEmptyChampion = (name: string): Champion =>
  Object.freeze({
    name,
    materialLibraryName: '',
    textureDatabaseName: '',
    modelName: '',
    chassisName: '',
    mass: 0,
    centreOfMass: Object.freeze([0, 0, 0] as const),
  })

const readName = (reader: TokenReader) =>
  reader.readStringWithMaximumLength(RECORD_NAME_MAXIMUM_LENGTH)

const applyKeyword = (
  reader: TokenReader,
  keyword: number,
  champion: Champion
): Champion | null => {
  switch (keyword) {
    case ChampionKeyword.MATERIAL_LIBRARY:
      return Object.freeze({ ...champion, materialLibraryName: readName(reader) })
    case ChampionKeyword.TEXTURE_DATABASE:
      return Object.freeze({ ...champion, textureDatabaseName: readName(reader) })
    case ChampionKeyword.MODEL:
      return Object.freeze({ ...champion, modelName: readName(reader) })
    case ChampionKeyword.CHASSIS:
      return Object.freeze({ ...champion, chassisName: readName(reader) })
    case ChampionKeyword.MASS:
      return Object.freeze({ ...champion, mass: reader.readFloat() })
    case ChampionKeyword.CENTRE_OF_MASS:
      return Object.freeze({ ...champion, centreOfMass: readFloatTriple(reader) })
    default:
      return null
  }
}

// LEGORacers.exe 0x0041d370: `0x27 [ count ] { (0x27 name { keywords }) * count }`.
export const parseChampionDatabase = (bytes: Uint8Array): ChampionDatabase => {
  const { records, readByteCount } = readNamedRecords(bytes, (reader, name) =>
    readKeywordBlock(reader, createEmptyChampion(name), (keyword, champion) =>
      applyKeyword(reader, keyword, champion)
    )
  )
  return Object.freeze({ champions: records, readByteCount })
}
