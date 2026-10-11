import { createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import type {
  BodyPartCatalog,
  CatalogBodyEntry,
  CatalogEntry,
  CatalogGroup,
} from '../../types/figure-builder.types.ts'

const WORLD_NAMES_KEYWORD = 0x27
const DIRECTORIES_KEYWORD = 0x28
const HATS_KEYWORD = 0x29
const HEADS_KEYWORD = 0x2a
const TORSOS_KEYWORD = 0x2b
const LEGS_KEYWORD = 0x2c
const HAT_MESHES_KEYWORD = 0x2d
const BODY_MODELS_KEYWORD = 0x2e
const BONES_KEYWORD = 0x2f
const MESH_NAME_COUNT = 2

const readStrings = (reader: TokenReader, count: number): readonly string[] =>
  Array.from({ length: count }, () => reader.readString())

// `[ count ] { string × count }`.
const readStringList = (reader: TokenReader): readonly string[] => {
  const strings = readStrings(reader, reader.readArrayCount())
  reader.expectRightCurly()
  return Object.freeze(strings)
}

const readEntry = (reader: TokenReader): CatalogEntry => {
  const name = reader.readString()
  return Object.freeze({ name, value: reader.readInteger() })
}

// `[ count ] { name integer × count }` (hats).
const readEntries = (reader: TokenReader): readonly CatalogEntry[] => {
  const entries = Array.from({ length: reader.readArrayCount() }, () => readEntry(reader))
  reader.expectRightCurly()
  return Object.freeze(entries)
}

// `[ count ] { mesh name, then count × (prefix, integer) }` (heads): one mesh name.
const readHeads = (reader: TokenReader): CatalogGroup<CatalogEntry> => {
  const count = reader.readArrayCount()
  const meshName = reader.readString()
  const entries = Array.from({ length: count }, () => readEntry(reader))
  reader.expectRightCurly()
  return Object.freeze({ meshNames: Object.freeze([meshName]), entries: Object.freeze(entries) })
}

// `[ count ] { two mesh names, then count × (name, type, integer) }` (torsos and legs).
const readBodyGroup = (reader: TokenReader): CatalogGroup<CatalogBodyEntry> => {
  const count = reader.readArrayCount()
  const meshNames = readStrings(reader, MESH_NAME_COUNT)
  const entries = Array.from({ length: count }, (): CatalogBodyEntry => {
    const name = reader.readString()
    const type = reader.readInteger()
    return Object.freeze({ name, type, value: reader.readInteger() })
  })
  reader.expectRightCurly()
  return Object.freeze({ meshNames: Object.freeze(meshNames), entries: Object.freeze(entries) })
}

const EMPTY_CATALOG: BodyPartCatalog = Object.freeze({
  directories: Object.freeze([]),
  worldNames: Object.freeze([]),
  hats: Object.freeze([]),
  hatMeshNames: Object.freeze([]),
  heads: Object.freeze({ meshNames: Object.freeze([]), entries: Object.freeze([]) }),
  torsos: Object.freeze({ meshNames: Object.freeze([]), entries: Object.freeze([]) }),
  legs: Object.freeze({ meshNames: Object.freeze([]), entries: Object.freeze([]) }),
  bodyModelNames: Object.freeze([]),
  boneNames: Object.freeze([]),
})

// BodyPartCatalog_Load 0x00498740 (reader 0x00498e90): the sections in any order until the end of the file; any other
// keyword is error 0x13. The original's reads are bounded (at most 30 heads, torsos and legs, 40 hats): this port keeps
// every entry the file has.
export const parseBodyPartCatalog = (bytes: Uint8Array): BodyPartCatalog => {
  const reader = createTokenReader(bytes)
  let catalog = EMPTY_CATALOG
  for (let keyword = reader.getNextToken(); keyword !== 0; keyword = reader.getNextToken()) {
    switch (keyword) {
      case DIRECTORIES_KEYWORD:
        catalog = { ...catalog, directories: readStringList(reader) }
        break
      case WORLD_NAMES_KEYWORD:
        catalog = { ...catalog, worldNames: readStringList(reader) }
        break
      case HATS_KEYWORD:
        catalog = { ...catalog, hats: readEntries(reader) }
        break
      case HEADS_KEYWORD:
        catalog = { ...catalog, heads: readHeads(reader) }
        break
      case TORSOS_KEYWORD:
        catalog = { ...catalog, torsos: readBodyGroup(reader) }
        break
      case LEGS_KEYWORD:
        catalog = { ...catalog, legs: readBodyGroup(reader) }
        break
      case HAT_MESHES_KEYWORD:
        catalog = { ...catalog, hatMeshNames: readStringList(reader) }
        break
      case BODY_MODELS_KEYWORD:
        catalog = { ...catalog, bodyModelNames: readStringList(reader) }
        break
      case BONES_KEYWORD:
        catalog = { ...catalog, boneNames: readStringList(reader) }
        break
      default:
        return reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
    }
  }
  return Object.freeze(catalog)
}
