import { createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import { findBrickColorIndex } from '../parse-brick-colors/parse-brick-colors.ts'
import { findBrickPieceByName } from '../parse-brick-database/parse-brick-database.ts'
import type {
  BrickColor,
  BrickDatabase,
  CarSet,
  CarSetBrick,
} from '../../types/car-builder.types.ts'

const SET_LIMIT_KEYWORD = 0x2e
const SET_MANAGER_KEYWORD = 0x2f
const SET_BRICKS_KEYWORD = 0x30
const SET_CHASSIS_KEYWORD = 0x31
const SET_NAME_LENGTH = 16
const CHASSIS_NAME_LENGTH = 8

// CRSTMGR.LEB (LegoCarSetManager_Load 0x0049ce80): `0x2f [ count ] { file name × count }`, the car set files of the
// menu (sixteen characters each).
export const parseCarSetFileNames = (bytes: Uint8Array): readonly string[] => {
  const reader = createTokenReader(bytes)
  reader.expectToken(SET_MANAGER_KEYWORD)
  const count = reader.readArrayCount()
  const names = Array.from({ length: count }, () => reader.readString().slice(0, SET_NAME_LENGTH))
  reader.expectRightCurly()
  return Object.freeze(names)
}

// LegoCarSet_Load 0x0049cb30: keywords until the end of the file. `0x2e` an integer, `0x31` the chassis name (eight
// characters), `0x30 [ count ] { piece name, colour name × count }` the bricks, each resolved against the brick
// database (an unknown piece gets id 0, 0x0049f4e0) and the colours (an unknown colour 0xffffffff, 0x00497d80). Any
// other keyword is error 0x13.
export const parseCarSet = (
  bytes: Uint8Array,
  database: BrickDatabase,
  colors: readonly BrickColor[]
): CarSet => {
  const reader = createTokenReader(bytes)
  let limit = 0
  let chassisName = ''
  let bricks: readonly CarSetBrick[] = []
  for (let keyword = reader.getNextToken(); keyword !== 0; keyword = reader.getNextToken()) {
    switch (keyword) {
      case SET_LIMIT_KEYWORD:
        limit = reader.readInteger()
        break
      case SET_CHASSIS_KEYWORD:
        chassisName = reader.readString().slice(0, CHASSIS_NAME_LENGTH)
        break
      case SET_BRICKS_KEYWORD: {
        const count = reader.readArrayCount()
        bricks = Object.freeze(
          Array.from({ length: count }, (): CarSetBrick => {
            const pieceName = reader.readString()
            const colorName = reader.readString()
            const colorIndex = findBrickColorIndex(colors, colorName)
            return Object.freeze({
              pieceName,
              pieceId: findBrickPieceByName(database, pieceName)?.id ?? 0,
              colorName,
              colorIndex: colorIndex < 0 ? 0xffffffff : colorIndex,
            })
          })
        )
        reader.expectRightCurly()
        break
      }
      default:
        return reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
    }
  }
  return Object.freeze({ chassisName, limit, bricks })
}
