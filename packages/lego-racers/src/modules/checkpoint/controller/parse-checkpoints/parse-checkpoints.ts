import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import { TooManyCheckpointsError } from '../../types/checkpoint-errors/checkpoint-errors.ts'
import {
  CheckpointKeyword,
  LINK_COUNT,
  MAXIMUM_CHECKPOINT_COUNT,
  NO_LINK,
  UNASSIGNED_PROGRESS,
} from '../../types/checkpoint-keyword/checkpoint-keyword.ts'
import type { CheckpointBlock, CheckpointList, Plane, Vector3 } from '../../types/checkpoint.types.ts'
import { assignCheckpointProgress } from '../assign-checkpoint-progress/assign-checkpoint-progress.ts'

const RESET_PLANE: Plane = Object.freeze([0, 0, 0, 0] as const)
const RESET_POINT: Vector3 = Object.freeze([0, 0, 0] as const)
const RESET_LINKS: readonly number[] = Object.freeze([NO_LINK, NO_LINK, NO_LINK, NO_LINK])

// 0x0041e640: `{ keywords }`; a mirrored track negates the plane's and the point's y.
const readCheckpointBlock = (
  reader: TokenReader,
  isMirrored: boolean
): CheckpointBlock => {
  reader.expectLeftCurly()
  let plane = RESET_PLANE
  let point = RESET_POINT
  let links = RESET_LINKS
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case CheckpointKeyword.PLANE: {
        const x = reader.readFloat()
        const y = reader.readFloat()
        const z = reader.readFloat()
        const distance = reader.readFloat()
        plane = Object.freeze([x, isMirrored ? -y : y, z, distance] as const)
        break
      }
      case CheckpointKeyword.LINKS:
        links = Object.freeze(Array.from({ length: LINK_COUNT }, () => reader.readInteger() & 0xff))
        break
      case CheckpointKeyword.POINT: {
        const x = reader.readFloat()
        const y = reader.readFloat()
        const z = reader.readFloat()
        point = Object.freeze([x, isMirrored ? -y : y, z] as const)
        break
      }
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({ plane, point, links })
}

// LEGORacers.exe 0x0041e770: `0x27 [ count ] { (0x27 { ... }) * count }`, then 0x0041e950 assigns progress.
export const parseCheckpoints = (bytes: Uint8Array, isMirrored: boolean): CheckpointList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(CheckpointKeyword.CHECKPOINT)
  const count = reader.readArrayCount() >>> 0
  if (count > MAXIMUM_CHECKPOINT_COUNT) throw new TooManyCheckpointsError(count)
  const blocks = Array.from({ length: count }, () => {
    reader.expectToken(CheckpointKeyword.CHECKPOINT)
    return readCheckpointBlock(reader, isMirrored)
  })
  reader.expectRightCurly()
  const progress = assignCheckpointProgress(blocks.map(({ links }) => links))
  return Object.freeze({
    checkpoints: Object.freeze(
      blocks.map((block, index) =>
        Object.freeze({ ...block, progress: progress[index] ?? UNASSIGNED_PROGRESS })
      )
    ),
    readByteCount: reader.getPosition(),
  })
}
