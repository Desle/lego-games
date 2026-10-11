import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { getSkeletonInstanceWithTime } from '../../../world-animation/index.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import {
  BUS_RECORDER_PATCHES,
  getLogCalls,
  LOG_BUFFER,
} from '../hazard-differential/hazard-differential.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { HAMMER_WATCHER, HAMMER_WATCHER_IDENTIFIER } from './hammer-watcher.ts'

// FUN_0048d150, the update of the hammer watcher (vtable 0x004b4434 slot +0x14).
const UPDATE_ADDRESS = 0x0048d150
const VTABLE_ADDRESS = 0x004b4434
const CASE_COUNT = 1500
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const BOUNDARIES: readonly number[] = [0, 20, 22, 28, 40, 60, 72, 78, 100, 300]

type UpdateCase = {
  readonly time: number
  readonly flags: number
  readonly state: number
}

const sampleCase = (sampler: FloatSampler): UpdateCase => ({
  time: sampler.getIsChance(25)
    ? (BOUNDARIES[sampler.sampleIntegerBelow(BOUNDARIES.length)] ?? 0)
    : sampler.sampleUniform(160) + 150,
  flags: sampler.sampleIntegerBelow(8),
  state: [1, 2, 2, 3][sampler.sampleIntegerBelow(4)] ?? 2,
})

const getEmulatorCall = (precision: EmulatorPrecision, item: UpdateCase): EmulatorCall => {
  const words: EmulatorArgument[] = Array.from({ length: 8 }, () => 0)
  words[0] = VTABLE_ADDRESS
  words[3] = item.state
  words[4] = { buffer: 'instance' }
  words[5] = item.flags
  const instance: EmulatorArgument[] = Array.from({ length: 0x40 }, () => 0)
  instance[0xb4 / 4] = getBitsFromFloat(item.time)
  return {
    address: UPDATE_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'hazard' }],
    buffers: [
      LOG_BUFFER,
      { name: 'hazard', words, isRead: true },
      { name: 'instance', words: instance, isRead: false },
    ],
    patches: BUS_RECORDER_PATCHES,
  }
}

const getPortResult = (item: UpdateCase): readonly (number | string)[] => {
  const test = createTestSession({
    track: createTestWorld([
      getSkeletonInstanceWithTime(createTestSkeletonInstance('rkhamm02'), item.time),
    ]),
  })
  const instance: HazardInstance = {
    definition: { keyword: 0x2a },
    identifier: HAMMER_WATCHER_IDENTIFIER,
    lifecycle: item.state,
    data: {
      keyword: 0x2a,
      hammer: { world: 'track', kind: 'skeleton', index: 0 },
      flags: item.flags,
    },
  }
  const updated = HAMMER_WATCHER.update(instance, test.session, 33)
  const data = updated.data
  return [updated.lifecycle, 'flags' in data ? data.flags : -1, ...test.calls]
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x48d150 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => {
    const item = sampleCase(sampler)
    return { ...item, time: Math.fround(item.time) }
  })
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getEmulatorCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const words = results[index]?.buffers['hazard'] ?? []
    const original = [
      words[3] ?? -1,
      words[5] ?? -1,
      ...getLogCalls(results[index]?.buffers['log'] ?? []),
    ]
    return original.join() === getPortResult(item).join() ? [] : [index]
  })
  const strikeCount = results.filter((result) => (result.buffers['log']?.[0] ?? 0) > 0).length

  // Assert
  expect(mismatches).toEqual([])
  expect(strikeCount).toBeGreaterThan(0)
}

describe.skipIf(!getIsEmulatorAvailable())('the hammer watcher against the original', () =>
  it.each(PRECISIONS)(
    '0x0048d150 matches the original in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)
