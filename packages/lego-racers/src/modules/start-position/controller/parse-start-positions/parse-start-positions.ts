import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import { StartPositionKeyword } from '../../types/start-position-keyword/start-position-keyword.ts'
import type { StartPosition, StartPositionList, Vector3 } from '../../types/start-position.types.ts'

const readVector = (reader: TokenReader, isMirrored: boolean): Vector3 => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  return Object.freeze([x, isMirrored ? -y : y, z] as const)
}

const readStartPosition = (reader: TokenReader, isMirrored: boolean): StartPosition => {
  reader.expectToken(StartPositionKeyword.START_POSITION)
  const slot = reader.readInteger()
  reader.expectLeftCurly()
  let position: Vector3 | null = null
  let firstAxis: Vector3 | null = null
  let secondAxis: Vector3 | null = null
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case StartPositionKeyword.POSITION:
        position = readVector(reader, isMirrored)
        break
      case StartPositionKeyword.AXES:
        firstAxis = readVector(reader, isMirrored)
        secondAxis = readVector(reader, isMirrored)
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({ slot, position, firstAxis, secondAxis })
}

// LEGORacers.exe 0x0043bc10: `0x27 [ count ] { (0x27 slot { ... }) * count }`; a mirror negates every y.
export const parseStartPositions = (bytes: Uint8Array, isMirrored: boolean): StartPositionList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(StartPositionKeyword.START_POSITION)
  const startPositions: StartPosition[] = []
  for (let remaining = reader.readArrayCount(); remaining !== 0; remaining -= 1) {
    startPositions.push(readStartPosition(reader, isMirrored))
  }
  reader.expectRightCurly()
  return Object.freeze({
    startPositions: Object.freeze(startPositions),
    readByteCount: reader.getPosition(),
  })
}
