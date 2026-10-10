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
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import { readRacerTables } from '../../services/read-racer-tables/read-racer-tables.ts'
import { readOriginalExecutable } from '../../../../shared/testing/original-files.ts'
import { createTestCarBody } from '../../types/racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import { updatePlayerGuidance } from './update-player-guidance.ts'

const WRONG_WAY_ADDRESS = 0x00439cf0
const TARGET_SIDE_ADDRESS = 0x00439ea0
const DISPLAY_FRAME_VTABLE = 0x004af754
const RACER_WORDS = 0xe34 / 4
const CASE_COUNT = 800
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const NO_LINK = 0xff

type Entry = readonly [number, EmulatorArgument]

type GuidanceCase = {
  readonly flags: number
  readonly countdown: number
  readonly heading: readonly number[]
  readonly plane: readonly number[]
  readonly links: readonly number[]
  readonly position: readonly number[]
  readonly target: readonly number[]
  readonly step: number
}

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleVector = (sampler: FloatSampler, limit: number): readonly number[] =>
  Array.from({ length: 3 }, () => sampler.sampleUniform(limit))

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleCase = (sampler: FloatSampler): GuidanceCase => {
  const heading = sampleVector(sampler, 1)
  const length = Math.hypot(...heading) || 1
  return {
    flags: sampleChoice(
      sampler,
      0,
      0x2000,
      0x4000,
      0x8000,
      0xa000,
      0xc000,
      0x10,
      0x10000,
      0x30000,
      0x8000 | 0x2000
    ),
    countdown: sampleChoice(sampler, 0, 0, 100, 500),
    heading: heading.map((value) => Math.fround(value / length)),
    plane: [...sampleVector(sampler, 1), sampler.sampleUniform(10)],
    links: [
      sampleChoice(sampler, 0, NO_LINK),
      sampleChoice(sampler, 1, NO_LINK, NO_LINK),
      NO_LINK,
      NO_LINK,
    ],
    position: sampleVector(sampler, 5),
    target: sampleVector(sampler, 5),
    step: sampleChoice(sampler, 1, 16, 40, 100, 500),
  }
}

const getCall = (
  precision: EmulatorPrecision,
  address: number,
  item: GuidanceCase,
  state: { readonly flags: number; readonly countdown: number },
  isThiscallWithStep: boolean
): EmulatorCall => ({
  address,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'racer' }, ...(isThiscallWithStep ? [item.step] : [])],
  buffers: [
    {
      name: 'racer',
      words: buildWords(RACER_WORDS, [
        [0x10 / 4, { buffer: 'list' }],
        [0x5c / 4, { buffer: 'display' }],
        [0xcc4 / 4, { buffer: 'checkpoint' }],
        [0xd04 / 4, state.flags],
        [0xd78 / 4, state.countdown],
        ...getFloatEntries(0x550 / 4, item.heading),
        ...getFloatEntries(0xdf8 / 4, item.target),
      ]),
      isRead: true,
    },
    {
      name: 'display',
      words: buildWords(32, [
        [0, DISPLAY_FRAME_VTABLE],
        ...getFloatEntries(0x4c / 4, item.position),
      ]),
      isRead: false,
    },
    { name: 'list', words: [0, 0], isRead: false },
    {
      name: 'checkpoint',
      words: buildWords(12, [
        ...getFloatEntries(0, item.plane),
        [8, item.links.reduce((word, link, index) => word | (link << (index * 8)), 0) >>> 0],
      ]),
      isRead: false,
    },
  ],
})

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x4399 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler))
  const context = {
    arithmetic: createFloatArithmetic(precision),
    tables: readRacerTables(readOriginalExecutable()),
    checkpoints: [] as never[],
    collisionObjects: [],
  }
  const session = openEmulatorSession()

  // Act
  const wrongWayResults = await session.callBatch(
    cases.map((item) =>
      getCall(
        precision,
        WRONG_WAY_ADDRESS,
        item,
        { flags: item.flags, countdown: item.countdown },
        true
      )
    )
  )
  const targetResults = await session.callBatch(
    cases.map((item, index) =>
      getCall(
        precision,
        TARGET_SIDE_ADDRESS,
        item,
        {
          flags: wrongWayResults[index]?.buffers['racer']?.[0xd04 / 4] ?? 0,
          countdown: wrongWayResults[index]?.buffers['racer']?.[0xd78 / 4] ?? 0,
        },
        false
      )
    )
  )
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const [x, y, z] = item.heading as [number, number, number]
    const [px, py, pz] = item.position as [number, number, number]
    const [tx, ty, tz] = item.target as [number, number, number]
    const body = createTestCarBody()
    const racer = Object.freeze({
      ...createRacer(
        Object.freeze({
          ...body,
          rigidBody: Object.freeze({
            ...body.rigidBody,
            heading: { x, y, z },
            displayFrame: { ...body.rigidBody.displayFrame, position: { x: px, y: py, z: pz } },
          }),
        })
      ),
      flags: item.flags,
      wrongWayMilliseconds: item.countdown,
      checkpointIndex: 0,
      guidanceTarget: { x: tx, y: ty, z: tz },
    })
    const [a, b, c, d] = item.plane as [number, number, number, number]
    const ported = updatePlayerGuidance(
      {
        ...context,
        checkpoints: [
          {
            plane: [a, b, c, d],
            point: [0, 0, 0],
            progress: 0,
            links: item.links,
          },
        ],
      },
      createRacerSet([racer], 0, 0),
      0,
      item.step
    )
    const result = getRacer(ported, 0)
    const original = targetResults[index]?.buffers['racer']
    const isSame =
      original?.[0xd04 / 4] === result.flags >>> 0 &&
      original[0xd78 / 4] === result.wrongWayMilliseconds
    return isSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('player guidance against the original', () =>
  it.each(PRECISIONS)(
    '0x00439cf0 then 0x00439ea0 match the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)
