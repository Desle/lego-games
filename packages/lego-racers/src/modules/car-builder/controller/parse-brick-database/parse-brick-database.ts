import { BinaryToken, createTokenReader } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import type {
  BrickDatabase,
  BrickFootprint,
  BrickPiece,
  BrickSections,
  PieceEntry,
} from '../../types/car-builder.types.ts'

const PIECES_KEYWORD = 0x27
const FACE_WORDS_KEYWORD = 0x28
const POSITIONS_KEYWORD = 0x29
const NORMALS_KEYWORD = 0x2a
const TEXTURE_COORDINATES_KEYWORD = 0x2b
const FOOTPRINT_PAIRS_KEYWORD = 0x2c
const PIECE_NAME_LENGTH = 8
// Pieces from this id on are the builder's own bricks; the lower ones are chassis parts (0x0049c6a0).
const FIRST_BRICK_ID = 0x800
// The first variant of the stud piece, whose face record count each attachable top cell adds (0x0049ee30).
const STUD_PIECE_ID = 0x800
const STUD_VARIANT = 1
const ATTACHABLE_TOP_FLAG = 0x80

const EMPTY_SECTIONS: BrickSections = Object.freeze({
  entries: Object.freeze([]),
  faceWords: new Uint16Array(0),
  positions: new Int16Array(0),
  normals: new Int8Array(0),
  textureCoordinates: new Int16Array(0),
  footprintPairs: new Uint8Array(0),
})

// 0x0049f410: after a section the reader skips to the closing curly brace (or the end of the file).
const skipToClosingCurly = (reader: TokenReader): void => {
  for (
    let token = reader.getNextToken();
    token !== BinaryToken.RIGHT_CURLY && token !== BinaryToken.END_OF_FILE;
    token = reader.getNextToken()
  ) {
    // Nothing: the tokens are not part of the section.
  }
}

const readIntegers = (reader: TokenReader, count: number): readonly number[] =>
  Array.from({ length: count }, () => reader.readInteger())

const readEntries = (reader: TokenReader): readonly PieceEntry[] =>
  Array.from({ length: reader.readArrayCount() }, () => {
    const name = reader.readString().slice(0, PIECE_NAME_LENGTH)
    const [id = 0, footprintOffset = 0, faceRecordCount = 0, geometryOffset = 0] = readIntegers(
      reader,
      4
    )
    return Object.freeze({ name, id, footprintOffset, faceRecordCount, geometryOffset })
  })

// Reads one section that follows the keyword: `[ count ] {`, `count × width` integers, `}`.
const readValues = (reader: TokenReader, width: number): readonly number[] => {
  const count = reader.readArrayCount()
  const values = readIntegers(reader, count * width)
  skipToClosingCurly(reader)
  return values
}

const readBrickSections = (bytes: Uint8Array): BrickSections => {
  const reader = createTokenReader(bytes)
  let sections = EMPTY_SECTIONS
  for (let keyword = reader.getNextToken(); keyword !== 0; keyword = reader.getNextToken()) {
    switch (keyword) {
      case PIECES_KEYWORD: {
        const entries = readEntries(reader)
        skipToClosingCurly(reader)
        sections = { ...sections, entries }
        break
      }
      case FACE_WORDS_KEYWORD:
        sections = { ...sections, faceWords: Uint16Array.from(readValues(reader, 1)) }
        break
      case POSITIONS_KEYWORD:
        sections = { ...sections, positions: Int16Array.from(readValues(reader, 3)) }
        break
      case NORMALS_KEYWORD:
        sections = { ...sections, normals: Int8Array.from(readValues(reader, 3)) }
        break
      case TEXTURE_COORDINATES_KEYWORD:
        sections = { ...sections, textureCoordinates: Int16Array.from(readValues(reader, 2)) }
        break
      case FOOTPRINT_PAIRS_KEYWORD:
        sections = { ...sections, footprintPairs: Uint8Array.from(readValues(reader, 2)) }
        break
      default:
        break
    }
  }
  return sections
}

// 0x0049ea60's layout: bytes 0 and 1 of the first pair are the width and the height, then `width · height` pairs, then a
// pair holding the 16-bit origin vertex index (0x0049eae0).
const getFootprint = (pairs: Uint8Array, offset: number): BrickFootprint => {
  const start = offset * 2
  const width = pairs[start] ?? 0
  const height = pairs[start + 1] ?? 0
  const cellStart = start + 2
  const cellEnd = cellStart + width * height * 2
  return Object.freeze({
    width,
    height,
    cells: pairs.slice(cellStart, cellEnd),
    originVertexIndex: (pairs[cellEnd] ?? 0) | ((pairs[cellEnd + 1] ?? 0) << 8),
  })
}

const getAttachableCellCount = (footprint: BrickFootprint): number => {
  let count = 0
  for (let index = 0; index < footprint.width * footprint.height; index += 1) {
    if (((footprint.cells[index * 2] ?? 0) & ATTACHABLE_TOP_FLAG) !== 0) count += 1
  }
  return count
}

// 0x0049ee30: the pieces sorted by id and face record count (qsort 0x0049f430), each knowing its rank among the pieces
// of its id.
const getSortedPieces = (sections: BrickSections): readonly BrickPiece[] => {
  const sorted = [...sections.entries].sort(
    (left, right) => left.id - right.id || left.faceRecordCount - right.faceRecordCount
  )
  return Object.freeze(
    sorted.map((entry, index) => {
      const sameId = sorted.filter((other) => other.id === entry.id)
      const firstOfId = sorted.findIndex((other) => other.id === entry.id)
      return Object.freeze({
        name: entry.name,
        id: entry.id,
        footprint: getFootprint(sections.footprintPairs, entry.footprintOffset),
        faceRecordCount: entry.faceRecordCount,
        geometryOffset: entry.geometryOffset,
        variantIndex: index - firstOfId,
        variantCount: sameId.length,
      })
    })
  )
}

// LegoBrickDatabase_Load 0x0049ee30: the six sections in any order (unknown keywords are skipped), then the sort and the
// two buffer sizes.
export const parseBrickDatabase = (bytes: Uint8Array): BrickDatabase => {
  const sections = readBrickSections(bytes)
  const pieces = getSortedPieces(sections)
  const studPiece = pieces.filter((piece) => piece.id === STUD_PIECE_ID)[STUD_VARIANT]
  const studFaceCount = studPiece?.faceRecordCount ?? 0
  const getFaceCount = (piece: BrickPiece): number =>
    piece.faceRecordCount + getAttachableCellCount(piece.footprint) * studFaceCount
  const getMaximum = (isBrick: boolean): number =>
    Math.max(
      0,
      ...pieces.filter((piece) => piece.id >= FIRST_BRICK_ID === isBrick).map(getFaceCount)
    )
  return Object.freeze({
    pieces,
    faceWords: sections.faceWords,
    positions: sections.positions,
    normals: sections.normals,
    textureCoordinates: sections.textureCoordinates,
    maximumBrickFaceCount: getMaximum(true),
    maximumPartFaceCount: getMaximum(false),
  })
}

// 0x0049f460: the piece of an id; `variantIndex` picks among the pieces sharing it (clamped, 0x0049f530).
export const findBrickPiece = (
  database: BrickDatabase,
  id: number,
  variantIndex: number
): BrickPiece | null => {
  const variants = database.pieces.filter((piece) => piece.id === id)
  if (variants.length === 0) return null
  const clamped = Math.min(Math.max(variantIndex, 0), variants.length - 1)
  return variants[clamped] ?? null
}

// 0x0049f4e0 with 0x0049ebf0: the first piece with a name, compared without regard to case over the whole name (a
// piece keeps at most eight characters, so a longer name matches none).
export const findBrickPieceByName = (database: BrickDatabase, name: string): BrickPiece | null =>
  database.pieces.find((piece) => piece.name.toLowerCase() === name.toLowerCase()) ?? null
