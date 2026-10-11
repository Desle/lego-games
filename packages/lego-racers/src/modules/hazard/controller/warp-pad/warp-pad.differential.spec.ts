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
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import {
  ACTIVATION_RECORDER_PATCHES,
  EFFECT_BUFFER,
  getRecordedActivation,
  LOG_BUFFER,
} from '../hazard-differential/hazard-differential.ts'
import { createTestRacer, createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { WARP_PAD } from './warp-pad.ts'

// FUN_0048af80, Begin of the warp pad (vtable 0x004b4194 slot +4).
const BEGIN_ADDRESS = 0x0048af80
const CASE_COUNT = 400
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

type BeginCase = {
  readonly state: number
  readonly isMirrored: boolean
  readonly racerFlags: number
  readonly isRacerPresent: boolean
}

const getEmulatorCall = (precision: EmulatorPrecision, item: BeginCase): EmulatorCall => {
  const hazard: EmulatorArgument[] = Array.from({ length: 8 }, () => 0)
  hazard[3] = item.state
  hazard[4] = { buffer: 'powerUps' }
  hazard[5] = item.isMirrored ? 1 : 0
  const racer: EmulatorArgument[] = Array.from({ length: 0x344 }, () => 0)
  racer[0xd04 / 4] = item.racerFlags
  return {
    address: BEGIN_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'hazard' }, item.isRacerPresent ? { buffer: 'racer' } : 0],
    buffers: [
      LOG_BUFFER,
      EFFECT_BUFFER,
      { name: 'hazard', words: hazard, isRead: true },
      {
        name: 'powerUps',
        words: Array.from({ length: 0x670 / 4 }, (): EmulatorArgument => 0),
        isRead: false,
      },
      { name: 'racer', words: racer, isRead: false },
    ],
    patches: ACTIVATION_RECORDER_PATCHES,
  }
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x48af80 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, (): BeginCase => ({
    state: sampler.sampleIntegerBelow(2) + 1,
    isMirrored: sampler.getIsChance(50),
    racerFlags: sampler.sampleIntegerBelow(0x40),
    isRacerPresent: sampler.getIsChance(80),
  }))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((item) => getEmulatorCall(precision, item)))
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const test = createTestSession()
    const instance: HazardInstance = {
      definition: { keyword: 0x49 },
      identifier: 0,
      lifecycle: item.state,
      data: { keyword: 0x49, isMirrored: item.isMirrored },
    }
    const begun = WARP_PAD.begin(
      instance,
      test.session,
      item.isRacerPresent ? createTestRacer(0, item.racerFlags) : null
    )
    const effect = test.effects[0]
    const ported =
      effect?.type === 'hazard.power_up_activated'
        ? [
            begun.lifecycle,
            1,
            effect.effectKind,
            ...(effect.launcher.position ?? []).map(getBitsFromFloat),
            ...(effect.launcher.direction ?? []).map(getBitsFromFloat),
          ]
        : [begun.lifecycle, 0]
    const recorded = getRecordedActivation(results[index]?.buffers['effect'] ?? [])
    const original =
      recorded === null
        ? [results[index]?.buffers['hazard']?.[3] ?? -1, 0]
        : [
            results[index]?.buffers['hazard']?.[3] ?? -1,
            1,
            recorded.kind,
            ...recorded.launcher.slice(0, 3),
            ...recorded.launcher.slice(3, 6),
          ]
    return original.join() === ported.join() ? [] : [index]
  })
  const warpCount = results.filter(
    (result) => getRecordedActivation(result.buffers['effect'] ?? []) !== null
  ).length

  // Assert
  expect(mismatches).toEqual([])
  expect(warpCount).toBeGreaterThan(0)
}

describe.skipIf(!getIsEmulatorAvailable())('the warp pad against the original', () =>
  it.each(PRECISIONS)(
    '0x0048af80 matches the original in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)
