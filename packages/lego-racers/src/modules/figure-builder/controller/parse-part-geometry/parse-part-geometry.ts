import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import type {
  GeometryPart,
  PartGeometry,
  PartGroup,
  VertexPool,
} from '../../types/figure-builder.types.ts'

const LIT_VERTICES_KEYWORD = 0x28
const COLORED_VERTICES_KEYWORD = 0x29
const PARTS_KEYWORD = 0x2c
const PART_SCALE_KEYWORD = 0x2d
const PART_GROUPS_KEYWORD = 0x2b
const GROUP_MATERIAL_KEYWORD = 0x27
const GROUP_TRIANGLES_KEYWORD = 0x2a
const MATERIAL_NAME_LENGTH = 8
// 0x004af4ac and 0x004af4b0 (set by 0x00407f90 and 0x00407fc0): 1/4096 and 1/127.
const TEXTURE_SCALE = Math.fround(1 / 4096)
const NORMAL_SCALE = Math.fround(1 / 127)
const LIT_VERTEX_INTEGER_COUNT = 8
const COLORED_VERTEX_INTEGER_COUNT = 9

const EMPTY_POOL: VertexPool = Object.freeze({
  positions: new Float32Array(0),
  textureCoordinates: new Float32Array(0),
  normals: null,
  colors: null,
})

const toSigned16 = (value: number): number => (value << 16) >> 16
const toSigned8 = (value: number): number => (value << 24) >> 24

// FUN_00408070: `[ count ] {` then per vertex five 16-bit values (x, y, z, u, v) and three bytes (a normal) or four (a colour).
const readVertexPool = (reader: TokenReader, isColored: boolean): VertexPool => {
  const count = reader.readArrayCount()
  const positions = new Float32Array(count * 3)
  const textureCoordinates = new Float32Array(count * 2)
  const normals = isColored ? null : new Float32Array(count * 3)
  const colors = isColored ? new Uint8Array(count * 4) : null
  const extraCount = isColored ? COLORED_VERTEX_INTEGER_COUNT - 5 : LIT_VERTEX_INTEGER_COUNT - 5
  for (let vertex = 0; vertex < count; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      positions[vertex * 3 + axis] = toSigned16(reader.readInteger())
    }
    for (let axis = 0; axis < 2; axis += 1) {
      textureCoordinates[vertex * 2 + axis] = Math.fround(
        toSigned16(reader.readInteger()) * TEXTURE_SCALE
      )
    }
    for (let extra = 0; extra < extraCount; extra += 1) {
      const value = reader.readInteger()
      if (normals !== null)
        normals[vertex * 3 + extra] = Math.fround(toSigned8(value) * NORMAL_SCALE)
      if (colors !== null) colors[vertex * 4 + extra] = value & 0xff
    }
  }
  reader.expectRightCurly()
  return { positions, textureCoordinates, normals, colors }
}

// FUN_00407e90: `0x2b { 0x27 name 0x2a [ count ] { 3 × count 16-bit indices } }`.
const readGroup = (reader: TokenReader): PartGroup => {
  reader.expectToken(PART_GROUPS_KEYWORD)
  reader.expectLeftCurly()
  let materialName = ''
  let triangles = new Uint16Array(0)
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    if (keyword === GROUP_MATERIAL_KEYWORD) {
      materialName = reader.readStringWithMaximumLength(MATERIAL_NAME_LENGTH)
    } else if (keyword === GROUP_TRIANGLES_KEYWORD) {
      const count = reader.readArrayCount()
      triangles = Uint16Array.from({ length: count * 3 }, () => reader.readInteger() & 0xffff)
      reader.expectRightCurly()
    } else {
      reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({ materialName, triangles })
}

// FUN_00407470: `{ 0x2b [ count ] { groups } | 0x2d scale }` until `}`; a scale the part does not set is 1 (0x00407440).
const readPart = (reader: TokenReader, name: string): GeometryPart => {
  reader.expectLeftCurly()
  let scale = 1
  let groups: readonly PartGroup[] = []
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    if (keyword === PART_GROUPS_KEYWORD) {
      const count = reader.readArrayCount()
      groups = Object.freeze(Array.from({ length: count }, () => readGroup(reader)))
      reader.expectRightCurly()
    } else if (keyword === PART_SCALE_KEYWORD) {
      scale = reader.readFloat()
    } else {
      reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({ name, scale, groups })
}

// FUN_00407810: `[ count ] { (0x2c name part) × count }`.
const readParts = (reader: TokenReader): readonly GeometryPart[] => {
  const count = reader.readArrayCount()
  const parts = Array.from({ length: count }, () => {
    reader.expectToken(PARTS_KEYWORD)
    return readPart(reader, reader.readString().slice(0, MATERIAL_NAME_LENGTH))
  })
  reader.expectRightCurly()
  return Object.freeze(parts)
}

// BuilderGeometry_Load 0x00407690: the sections in any order until the end of the file; the vertex pool a later `0x28`
// or `0x29` section reads replaces the earlier one.
export const parsePartGeometry = (bytes: Uint8Array): PartGeometry => {
  const reader = createTokenReader(bytes)
  let pool = EMPTY_POOL
  let parts: readonly GeometryPart[] = []
  for (let keyword = reader.getNextToken(); keyword !== 0; keyword = reader.getNextToken()) {
    if (keyword === LIT_VERTICES_KEYWORD) pool = readVertexPool(reader, false)
    else if (keyword === COLORED_VERTICES_KEYWORD) pool = readVertexPool(reader, true)
    else if (keyword === PARTS_KEYWORD) parts = readParts(reader)
  }
  return Object.freeze({ ...pool, parts })
}
