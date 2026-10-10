import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import { readRacerTables } from '../../services/read-racer-tables/read-racer-tables.ts'
import { readOriginalExecutable } from '../../../../shared/testing/original-files.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import { createTestCarBody } from '../../types/racer-fixtures/racer-fixtures.ts'
import { notifyRacerContact } from './notify-racer-contact.ts'

const NOTIFY_ADDRESS = 0x00422100
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 60_000
// Effect words: +0x00 device, +0x04 strength, +0x0c duration, +0x10 phase, +0x18 state, +0x1c elapsed.
const CASES = Object.freeze(
  [0, 1].flatMap((device) =>
    [0, 2, 3].map((state) => ({ device, state, strength: 7, duration: 9, phase: 5, elapsed: 11 }))
  )
)

const getCall = (precision: EmulatorPrecision, item: (typeof CASES)[number]): EmulatorCall => ({
  address: NOTIFY_ADDRESS,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'effect' }],
  buffers: [
    {
      name: 'effect',
      words: [
        item.device,
        item.strength,
        0,
        item.duration,
        item.phase,
        0,
        item.state,
        item.elapsed,
      ],
      isRead: true,
    },
  ],
})

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const context = {
    arithmetic: createFloatArithmetic(precision),
    tables: readRacerTables(readOriginalExecutable()),
    checkpoints: [],
    collisionObjects: [],
  }
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(CASES.map((item) => getCall(precision, item)))
  await session.close()
  const mismatches = CASES.flatMap((item, index) => {
    const racer = Object.freeze({
      ...createRacer(createTestCarBody()),
      forceFeedback: {
        isPresent: item.device !== 0,
        strength: item.strength,
        duration: item.duration,
        phase: item.phase,
        state: item.state,
        elapsed: item.elapsed,
      },
    })
    const { forceFeedback } = getRacer(
      notifyRacerContact(context, createRacerSet([racer], 0, 0), 0, 1),
      0
    )
    const original = results[index]?.buffers['effect'] ?? []
    const ported = [
      item.device,
      forceFeedback.strength,
      0,
      forceFeedback.duration,
      forceFeedback.phase,
      0,
      forceFeedback.state,
      forceFeedback.elapsed,
    ]
    return original.join() === ported.join() ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('contact notification against the original', () =>
  it.each(PRECISIONS)(
    '0x00422100 matches the original in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)
