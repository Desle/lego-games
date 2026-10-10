import { getSignedShort, getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import {
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  ComputerRacerRouteKeyword,
  SAMPLE_BYTE_COUNT,
} from '../../types/computer-racer-route-keyword/computer-racer-route-keyword.ts'
import type {
  ComputerRacerRoute,
  ComputerRacerRouteSample,
  Quaternion,
  Vector3,
} from '../../types/computer-racer-route.types.ts'

const readVector = (reader: TokenReader, isMirrored: boolean): Vector3 => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  return Object.freeze([x, isMirrored ? -y : y, z] as const)
}

// 0x004a4f36 and 0x004a4fd7: a mirrored route negates the second and fourth component.
const readQuaternion = (reader: TokenReader, isMirrored: boolean): Quaternion => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  const w = reader.readFloat()
  return Object.freeze(isMirrored ? ([x, -y, z, -w] as const) : ([x, y, z, w] as const))
}

// 0x004a5e10: a mirrored sample negates the second int16 and bytes 2 and 4, and swaps bytes 5 and 6.
const readSample = (reader: TokenReader, isMirrored: boolean): ComputerRacerRouteSample => {
  const first = getSignedShort(reader.readInteger())
  const second = getSignedShort(reader.readInteger())
  const bytes = Array.from({ length: SAMPLE_BYTE_COUNT }, () =>
    getUnsignedByte(reader.readInteger())
  )
  if (!isMirrored) return Object.freeze({ first, second, bytes: Object.freeze(bytes) })
  const [byte0 = 0, byte1 = 0, byte2 = 0, byte3 = 0, byte4 = 0, byte5 = 0, byte6 = 0, byte7 = 0] =
    bytes
  return Object.freeze({
    first,
    second: getSignedShort(-second),
    bytes: Object.freeze([
      byte0,
      byte1,
      getUnsignedByte(-byte2),
      byte3,
      getUnsignedByte(-byte4),
      byte6,
      byte5,
      byte7,
    ]),
  })
}

// 0x004a5100: `[ count ] { sample... }`.
const readSamples = (
  reader: TokenReader,
  isMirrored: boolean
): readonly ComputerRacerRouteSample[] => {
  const count = reader.readArrayCount() >>> 0
  const samples = Array.from({ length: count }, () => readSample(reader, isMirrored))
  reader.expectRightCurly()
  return Object.freeze(samples)
}

const ZERO_VECTOR: Vector3 = Object.freeze([0, 0, 0] as const)
const IDENTITY_QUATERNION: Quaternion = Object.freeze([0, 0, 0, 1] as const)

// LEGORacers.exe 0x004a4e30: keywords until the end of the file; tokens outside 0x27..0x2d are skipped.
export const parseComputerRacerRoute = (
  bytes: Uint8Array,
  isMirrored: boolean
): ComputerRacerRoute => {
  const reader = createTokenReader(bytes)
  let firstVector = ZERO_VECTOR
  let firstQuaternion = IDENTITY_QUATERNION
  let secondVector = ZERO_VECTOR
  let secondQuaternion = IDENTITY_QUATERNION
  let firstInteger = 0
  let sampleIndex = 0
  let samples: readonly ComputerRacerRouteSample[] = Object.freeze([])
  for (let keyword = reader.getNextToken(); keyword !== 0; keyword = reader.getNextToken()) {
    switch (keyword) {
      case ComputerRacerRouteKeyword.SAMPLES:
        samples = readSamples(reader, isMirrored)
        break
      case ComputerRacerRouteKeyword.FIRST_QUATERNION:
        firstQuaternion = readQuaternion(reader, isMirrored)
        break
      case ComputerRacerRouteKeyword.FIRST_VECTOR:
        firstVector = readVector(reader, isMirrored)
        break
      case ComputerRacerRouteKeyword.SECOND_VECTOR:
        secondVector = readVector(reader, isMirrored)
        break
      case ComputerRacerRouteKeyword.SECOND_QUATERNION:
        secondQuaternion = readQuaternion(reader, isMirrored)
        break
      case ComputerRacerRouteKeyword.FIRST_INTEGER:
        firstInteger = reader.readInteger()
        break
      case ComputerRacerRouteKeyword.SAMPLE_INDEX:
        sampleIndex = reader.readInteger()
        break
      default:
        break
    }
  }
  // 0x004a503b: an unsigned compare of the index against the sample count.
  if (sampleIndex >>> 0 >= samples.length) reader.fail(TokenReaderFailure.INVALID_VALUE)
  return Object.freeze({
    firstVector,
    firstQuaternion,
    secondVector,
    secondQuaternion,
    firstInteger,
    sampleIndex,
    samples,
    readByteCount: reader.getPosition(),
  })
}
