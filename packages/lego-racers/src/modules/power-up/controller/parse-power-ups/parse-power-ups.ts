import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  DEFAULT_BRICK_KIND,
  DEFAULT_IDENTIFIER,
  IGNORED_NAME_MAXIMUM_LENGTH,
  PowerUpKeyword,
} from '../../types/power-up-keyword/power-up-keyword.ts'
import type {
  EnhancementBrick,
  PowerUpBrick,
  PowerUpPlacements,
  Vector3,
} from '../../types/power-up.types.ts'

const ORIGIN: Vector3 = Object.freeze([0, 0, 0] as const)

const BRICK_KINDS: ReadonlyMap<number, number> = new Map([
  [PowerUpKeyword.BRICK_KIND_1, 1],
  [PowerUpKeyword.BRICK_KIND_2, 2],
  [PowerUpKeyword.BRICK_KIND_3, 3],
  [PowerUpKeyword.BRICK_KIND_4, 4],
])

const readPosition = (reader: TokenReader): Vector3 => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  return Object.freeze([x, y, z] as const)
}

// The y is negated after the block is read, when the race is mirrored.
const mirrorPosition = (position: Vector3, isMirrored: boolean): Vector3 =>
  isMirrored ? Object.freeze([position[0], -position[1], position[2]] as const) : position

// 0x30 falls through into 0x31: a name, then an integer, both dropped.
const skipIgnoredValues = (reader: TokenReader, keyword: number): void => {
  if (keyword === PowerUpKeyword.IGNORED_NAME_AND_INTEGER) {
    reader.readStringWithMaximumLength(IGNORED_NAME_MAXIMUM_LENGTH)
  }
  reader.readInteger()
}

const getIsIgnoredKeyword = (keyword: number) =>
  keyword === PowerUpKeyword.IGNORED_NAME_AND_INTEGER || keyword === PowerUpKeyword.IGNORED_INTEGER

const readBrick = (reader: TokenReader, isMirrored: boolean): PowerUpBrick => {
  reader.expectToken(PowerUpKeyword.BRICK)
  reader.expectLeftCurly()
  let position = ORIGIN
  let kind = DEFAULT_BRICK_KIND
  let identifier = DEFAULT_IDENTIFIER
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    const brickKind = BRICK_KINDS.get(keyword)
    if (brickKind !== undefined) kind = brickKind
    else if (keyword === PowerUpKeyword.POSITION) position = readPosition(reader)
    else if (keyword === PowerUpKeyword.IDENTIFIER) identifier = reader.readInteger()
    else if (getIsIgnoredKeyword(keyword)) skipIgnoredValues(reader, keyword)
    else reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
  return Object.freeze({ position: mirrorPosition(position, isMirrored), kind, identifier })
}

const readEnhancementBrick = (reader: TokenReader, isMirrored: boolean): EnhancementBrick => {
  reader.expectToken(PowerUpKeyword.ENHANCEMENT_BRICK)
  reader.expectLeftCurly()
  let position = ORIGIN
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    if (keyword === PowerUpKeyword.POSITION) position = readPosition(reader)
    else if (getIsIgnoredKeyword(keyword)) skipIgnoredValues(reader, keyword)
    else reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
  return Object.freeze({ position: mirrorPosition(position, isMirrored) })
}

// `[ count ]`, and when count is not 0, `{ block * count }`.
const readList = <Block>(reader: TokenReader, readBlock: () => Block): readonly Block[] => {
  const count = reader.readArrayCount() >>> 0
  if (count === 0) return Object.freeze([])
  const blocks = Array.from({ length: count }, readBlock)
  reader.expectRightCurly()
  return Object.freeze(blocks)
}

// LEGORacers.exe 0x00458810: keywords until the end of the file; 0x27 and 0x2f each read a list, others are skipped.
export const parsePowerUps = (bytes: Uint8Array, isMirrored: boolean): PowerUpPlacements => {
  const reader = createTokenReader(bytes)
  let bricks: readonly PowerUpBrick[] = Object.freeze([])
  let enhancementBricks: readonly EnhancementBrick[] = Object.freeze([])
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.END_OF_FILE;
    keyword = reader.getNextToken()
  ) {
    if (keyword === PowerUpKeyword.BRICK) {
      bricks = readList(reader, () => readBrick(reader, isMirrored))
    } else if (keyword === PowerUpKeyword.ENHANCEMENT_BRICK) {
      enhancementBricks = readList(reader, () => readEnhancementBrick(reader, isMirrored))
    }
  }
  return Object.freeze({ bricks, enhancementBricks, readByteCount: reader.getPosition() })
}
