import { getSignedShort, getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import { TooManyGhostSamplesError } from '../../types/ghost-errors/ghost-errors.ts'
import {
  GhostKeyword,
  MAXIMUM_SAMPLE_COUNT,
  SAMPLE_BYTE_COUNT,
} from '../../types/ghost-keyword/ghost-keyword.ts'
import type { Ghost, GhostSample, Quaternion, Vector3 } from '../../types/ghost.types.ts'

// A mirrored ghost (ghost flags bit 0x20) negates the y short and orientation bytes 1 and 3.
const readSample = (reader: TokenReader, isMirrored: boolean): GhostSample => {
  const x = getSignedShort(reader.readInteger())
  const y = getSignedShort(reader.readInteger())
  const z = getSignedShort(reader.readInteger())
  const bytes = Array.from({ length: SAMPLE_BYTE_COUNT }, () =>
    getUnsignedByte(reader.readInteger())
  )
  const [first = 0, second = 0, third = 0, fourth = 0] = bytes
  return Object.freeze({
    position: Object.freeze([x, isMirrored ? getSignedShort(-y) : y, z] as const),
    orientationBytes: Object.freeze(
      isMirrored ? [first, getUnsignedByte(-second), third, getUnsignedByte(-fourth)] : bytes
    ),
  })
}

const readSamples = (reader: TokenReader, isMirrored: boolean): readonly GhostSample[] => {
  const count = reader.readArrayCount() >>> 0
  if (count > MAXIMUM_SAMPLE_COUNT) throw new TooManyGhostSamplesError(count)
  const samples = Array.from({ length: count }, () => readSample(reader, isMirrored))
  reader.expectRightCurly()
  return Object.freeze(samples)
}

const readVector = (reader: TokenReader, isMirrored: boolean): Vector3 => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  return Object.freeze([x, isMirrored ? -y : y, z] as const)
}

const readQuaternion = (reader: TokenReader, isMirrored: boolean): Quaternion => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  const w = reader.readFloat()
  return Object.freeze(isMirrored ? ([x, -y, z, -w] as const) : ([x, y, z, w] as const))
}

const applyKeyword = (
  reader: TokenReader,
  keyword: number,
  ghost: Ghost,
  isMirrored: boolean
): Ghost => {
  switch (keyword) {
    case GhostKeyword.SAMPLES:
      return { ...ghost, samples: readSamples(reader, isMirrored) }
    case GhostKeyword.START_POSITION:
      return { ...ghost, startPosition: readVector(reader, isMirrored) }
    case GhostKeyword.START_QUATERNION:
      return { ...ghost, startQuaternion: readQuaternion(reader, isMirrored) }
    case GhostKeyword.FIRST_INTEGERS: {
      const first = reader.readInteger()
      const second = reader.readInteger()
      const third = reader.readInteger()
      return { ...ghost, firstIntegers: Object.freeze([first, second, third] as const) }
    }
    case GhostKeyword.SECOND_INTEGER:
      return { ...ghost, secondInteger: reader.readInteger() }
    default:
      return reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
}

// LEGORacers.exe 0x00423160: `0x2c { keywords }`; nothing after the curly is read.
export const parseGhost = (bytes: Uint8Array, isMirrored: boolean): Ghost => {
  const reader = createTokenReader(bytes)
  reader.expectToken(GhostKeyword.GHOST)
  reader.expectLeftCurly()
  let ghost: Ghost = {
    firstIntegers: null,
    secondInteger: null,
    startPosition: null,
    startQuaternion: null,
    samples: Object.freeze([]),
    readByteCount: 0,
  }
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    ghost = applyKeyword(reader, keyword, ghost, isMirrored)
  }
  return Object.freeze({ ...ghost, readByteCount: reader.getPosition() })
}
