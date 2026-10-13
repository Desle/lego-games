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
import { createTestRacer, createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { getLogCalls, LOG_BUFFER } from './hazard-differential.ts'
import {
  CAR_BODY_WORD,
  FIGURE_WORD,
  FORWARD_SPEED_WORD,
  getSlotCalls,
  getTouchSupportBuffers,
  RACER_FLAGS_WORD,
  RACER_WORD_COUNT,
  SLOT_LOG_BUFFER,
  SPIN_FLAGS_WORD,
  TOUCH_RECORDER_PATCHES,
} from './hazard-touch-differential.ts'
import type {
  TouchCase,
  TouchPortOutcome,
  TouchSuiteDefinition,
} from './hazard-touch-differential-suite.types.ts'

const CASE_COUNT = 600
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const FORWARD_SPEEDS: readonly number[] = [0, -0, 0.5, 12.75, -3, 200]
const SPIN_COMMAND = 'spin 1065353216 1008981770 0'
const FLING_COMMANDS: readonly string[] = [SPIN_COMMAND, 'flag', 'impulse 0 0 1125515264']

const sampleCase = (sampler: FloatSampler): TouchCase => ({
  racerFlags: sampler.sampleIntegerBelow(4),
  spinFlags: sampler.sampleIntegerBelow(0x100),
  forwardSpeed: FORWARD_SPEEDS[sampler.sampleIntegerBelow(FORWARD_SPEEDS.length)] ?? 0,
})

const getEmulatorCall = (
  definition: TouchSuiteDefinition,
  precision: EmulatorPrecision,
  item: TouchCase
): EmulatorCall => {
  const racer: EmulatorArgument[] = Array.from({ length: RACER_WORD_COUNT }, () => 0)
  racer[CAR_BODY_WORD] = { buffer: 'carBodyVtable' }
  racer[FIGURE_WORD] = { buffer: 'figure' }
  racer[SPIN_FLAGS_WORD] = item.spinFlags
  racer[FORWARD_SPEED_WORD] = getBitsFromFloat(item.forwardSpeed)
  racer[RACER_FLAGS_WORD] = item.racerFlags
  const contact: EmulatorArgument[] = Array.from({ length: 8 }, () => 0)
  contact[0x14 / 4] = { buffer: 'racer' }
  return {
    address: definition.address,
    convention: 'thiscall',
    precision,
    arguments: [{ buffer: 'hazard' }, { buffer: 'contact' }],
    buffers: [
      LOG_BUFFER,
      SLOT_LOG_BUFFER,
      { name: 'hazard', words: definition.getHazardWords(), isRead: true },
      { name: 'contact', words: contact, isRead: false },
      { name: 'racer', words: racer, isRead: false },
      ...getTouchSupportBuffers(),
    ],
    patches: TOUCH_RECORDER_PATCHES,
  }
}

// The slot and bus calls a port reaction stands for, in the order the original makes them.
const getPortCommands = (definition: TouchSuiteDefinition, item: TouchCase): TouchPortOutcome => {
  const test = createTestSession()
  const instance = definition.behavior.touch(
    definition.instance,
    test.session,
    createTestRacer(1, item.racerFlags, {
      isSpinning: (item.spinFlags & 2) !== 0,
      isColourShifted: false,
      forwardSpeed: item.forwardSpeed,
    })
  )
  const reactions = test.effects.flatMap((effect) =>
    effect.type === 'hazard.racer_affected' ? [effect.reaction] : []
  )
  const slotCommands = reactions.flatMap((reaction) =>
    reaction === 'flung' ? FLING_COMMANDS : [SPIN_COMMAND]
  )
  return { commands: [...slotCommands, ...test.calls], instance }
}

const expectMatchesOriginal = async (
  definition: TouchSuiteDefinition,
  precision: EmulatorPrecision
): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(definition.address + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(
    cases.map((item) => getEmulatorCall(definition, precision, item))
  )
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const result = results[index]
    const ported = getPortCommands(definition, item)
    const original = [
      ...getSlotCalls(result?.buffers['slotLog'] ?? []),
      ...getLogCalls(result?.buffers['log'] ?? []),
    ]
    const originalState = definition.getOriginalState(result?.buffers['hazard'] ?? [])
    const portedState = definition.getPortState(ported.instance)
    return original.join('|') === ported.commands.join('|') && originalState === portedState
      ? []
      : [{ index, item, original, ported: ported.commands }]
  })
  const reactingCount = results.filter(
    (result) =>
      getSlotCalls(result.buffers['slotLog'] ?? []).length > 0 ||
      definition.getOriginalState(result.buffers['hazard'] ?? []) !==
        definition.getPortState(definition.instance)
  ).length

  // Assert
  expect(mismatches).toEqual([])
  expect(reactingCount).toBeGreaterThan(0)
}

// Registers a differential case per precision for a touch callback: the original's calls against the port's effects.
export const defineTouchDifferential = (definition: TouchSuiteDefinition) =>
  describe.skipIf(!getIsEmulatorAvailable())(`${definition.name} against the original`, () =>
    it.each(PRECISIONS)(
      `${definition.label} matches the original in %s precision`,
      (precision) => expectMatchesOriginal(definition, precision),
      TEST_TIMEOUT_IN_MILLISECONDS
    )
  )
