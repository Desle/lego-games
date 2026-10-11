import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type {
  BspBoundingVolume,
  BspPlane,
  BspVolumeVisibility,
} from '../../types/bsp-tree.types.ts'
import { getVolumeVisibility } from './get-visible-bsp-leaves.ts'

const VISIBILITY_ADDRESS = 0x1002bc90
// The frustum object holds its six planes from +0x6c (word 27), four floats each.
const FRUSTUM_WORDS = 51
const FIRST_PLANE_WORD = 27
const PLANE_COUNT = 6
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const RESULTS: readonly BspVolumeVisibility[] = ['outside', 'partly_inside', 'inside']
// The engine returns 0 (outside), 1 (partly outside), 2 (inside).
const INSIDE_RESULT = 2
const OUTSIDE_RESULT = 0

type VolumeCase = {
  readonly planes: readonly BspPlane[]
  readonly volume: BspBoundingVolume
}

const sampleCase = (sampler: FloatSampler): VolumeCase => {
  const planes = Array.from({ length: PLANE_COUNT }, (): BspPlane => {
    const [x, y, z] = sampler.sampleList(3, 1).map(Math.fround) as [number, number, number]
    return [x, y, z, Math.fround(sampler.sampleUniform(40))]
  })
  const [x, y, z] = sampler.sampleList(3, 30).map(Math.fround) as [number, number, number]
  const [width, depth, height] = sampler
    .sampleList(3, 20)
    .map((size) => Math.fround(Math.abs(size)))
  return {
    planes,
    volume: [
      x,
      y,
      z,
      Math.fround(x + (width ?? 0)),
      Math.fround(y + (depth ?? 0)),
      Math.fround(z + (height ?? 0)),
    ],
  }
}

const getCall = (precision: EmulatorPrecision, item: VolumeCase): EmulatorCall => {
  const frustumWords = [
    ...Array.from({ length: FIRST_PLANE_WORD }, () => 0),
    ...item.planes.flat().map(getBitsFromFloat),
    ...Array.from({ length: FRUSTUM_WORDS - FIRST_PLANE_WORD - PLANE_COUNT * 4 }, () => 0),
  ]
  return {
    address: VISIBILITY_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'frustum' }, { buffer: 'volume' }],
    buffers: [
      { name: 'frustum', words: frustumWords, isRead: false },
      { name: 'volume', words: item.volume.map(getBitsFromFloat), isRead: false },
    ],
  }
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x1002bc90 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler))
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const port = getVolumeVisibility(arithmetic, item.planes, item.volume)
    return port === RESULTS[results[index]?.eax ?? -1] ? [] : [index]
  })
  const portResults = new Set(
    cases.map((item) => getVolumeVisibility(arithmetic, item.planes, item.volume))
  )

  // Assert
  expect(mismatches).toEqual([])
  expect(portResults).toEqual(new Set(RESULTS))
  expect(RESULTS[INSIDE_RESULT]).toBe('inside')
  expect(RESULTS[OUTSIDE_RESULT]).toBe('outside')
}

describe.skipIf(!getIsEmulatorAvailable())('BSP volume visibility against the original', () =>
  it.each(PRECISIONS)(
    '0x1002bc90 matches the original in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)
