import {
  encodeArrayHeader,
  encodeFloat,
  encodeInteger,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { getSignedShort, getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import { BinaryToken } from '../../../token-reader/index.ts'
import { GhostKeyword } from '../../types/ghost-keyword/ghost-keyword.ts'
import type { GhostSample } from '../../types/ghost.types.ts'
import type { GhostRun } from '../../types/ghost-run/ghost-run.types.ts'

const getIntegers = (values: readonly number[]): readonly number[] =>
  values.flatMap((value) => encodeInteger(value))

const getFloats = (values: readonly number[]): readonly number[] =>
  values.flatMap((value) => encodeFloat(value))

// parseGhost negates y and orientation bytes 1 and 3 of a mirrored track's samples; negating again undoes it.
const getEncodedSample = (sample: GhostSample, isMirrored: boolean): readonly number[] => {
  const [x, y, z] = sample.position
  const [first = 0, second = 0, third = 0, fourth = 0] = sample.orientationBytes
  return getIntegers([
    x,
    isMirrored ? getSignedShort(-y) : y,
    z,
    first,
    isMirrored ? getUnsignedByte(-second) : second,
    third,
    isMirrored ? getUnsignedByte(-fourth) : fourth,
  ])
}

// The inverse of parseGhost: the bytes of a GHOST.GHB for a recorded run. The original never writes ghost files (the
// best run lives in memory for the session); this lets a viewer keep one. `isMirrored` is the track's flag, so a
// ghost recorded on a mirrored track is stored the way the loader expects to find it.
export const encodeGhost = (run: GhostRun, isMirrored: boolean): Uint8Array => {
  const [positionX, positionY, positionZ] = run.startPosition
  const [quaternionX, quaternionY, quaternionZ, quaternionW] = run.startQuaternion
  return new Uint8Array([
    GhostKeyword.GHOST,
    BinaryToken.LEFT_CURLY,
    GhostKeyword.FIRST_INTEGERS,
    ...getIntegers(run.lapMilliseconds),
    GhostKeyword.SECOND_INTEGER,
    ...getIntegers([run.secondInteger]),
    GhostKeyword.START_POSITION,
    ...getFloats([positionX, isMirrored ? -positionY : positionY, positionZ]),
    GhostKeyword.START_QUATERNION,
    ...getFloats([
      quaternionX,
      isMirrored ? -quaternionY : quaternionY,
      quaternionZ,
      isMirrored ? -quaternionW : quaternionW,
    ]),
    GhostKeyword.SAMPLES,
    ...encodeArrayHeader(run.samples.length),
    ...run.samples.flatMap((sample) => getEncodedSample(sample, isMirrored)),
    BinaryToken.RIGHT_CURLY,
    BinaryToken.RIGHT_CURLY,
  ])
}
