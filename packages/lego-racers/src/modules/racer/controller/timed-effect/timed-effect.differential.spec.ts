import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorPatch,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat, getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatArithmetic,
  FpuPrecision,
  type FloatArithmetic,
} from '../../../simulation-math/index.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { createTestContext } from '../../types/racer-fixtures/racer-fixtures.ts'
import { createTestRacerSet } from '../../types/racer-fixtures/racer-fixtures.ts'
import { getRacer } from '../../types/racer-state/racer-state.ts'
import type { Racer } from '../../types/racer.types.ts'
import { endCarBodyEffect, endTimedEffect, transferTimedEffect } from './timed-effect.ts'

const TRANSFER_ADDRESS = 0x00439900
const END_ADDRESS = 0x00439b00
const END_CAR_BODY_ADDRESS = 0x004397b0
const CAR_BODY_VTABLE = 0x004b04e4
const RACER_WORDS = 0xe34 / 4
const BODY_WORD = 0x3e8 / 4
const CASE_COUNT = 800
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
// Free code in the stub page of the emulator: `ret 0xc` for the figure's slot 0x58, `ret` for its slot 0x54.
const RETURN_THREE_ARGUMENTS_STUB = 0x7e00fc40
const RETURN_STUB = 0x7e00fc60

type Entry = readonly [number, EmulatorArgument]

type EffectCase = {
  readonly racerFlags: number
  readonly driverFlags: number
  readonly reactions: number
  readonly milliseconds: number
  readonly charge: number
  readonly giverMilliseconds: number
  readonly bodyFlags: number
  readonly isScripted: boolean
  readonly speedFactor: number
  readonly target: number
  readonly topSpeedScale: number
  readonly throttle: number
  readonly gripScale: number
  readonly topSpeed: number
  readonly drag: number
  readonly flaggedTimer: number
}

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleEffectCase = (sampler: FloatSampler): EffectCase => ({
  racerFlags: sampleChoice(sampler, 0, 0x800, 0x1, 0x10000000, 0x800 | 0x1000),
  driverFlags: sampleChoice(sampler, 0, 0x10, 0x40, 0x80, 0x50),
  reactions: sampleChoice(sampler, 0, 1, 2, 3),
  milliseconds: sampleChoice(sampler, 0, 300, 3000),
  charge: sampleChoice(sampler, 0, 1000),
  giverMilliseconds: sampleChoice(sampler, 0, 100, 2500),
  bodyFlags: sampleChoice(
    sampler,
    0,
    0x10000,
    0x80000,
    0x90000,
    0x50002,
    0x10002,
    0x40000,
    0x80,
    0x10080
  ),
  isScripted: sampler.getIsChance(50),
  speedFactor: Math.fround(sampler.sampleUniform(2)),
  target: Math.fround(sampler.sampleUniform(2)),
  topSpeedScale: Math.fround(Math.abs(sampler.sampleUniform(2))),
  throttle: Math.fround(sampler.sampleUniform(2)),
  gripScale: Math.fround(sampler.sampleUniform(2)),
  topSpeed: Math.fround(10 + Math.abs(sampler.sampleUniform(100))),
  drag: Math.fround(sampler.sampleUniform(0.01)),
  flaggedTimer: sampleChoice(sampler, 0, 40),
})

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getRacerWords = (item: EffectCase): readonly EmulatorArgument[] => {
  const at = (offset: number): number => offset / 4
  return buildWords(RACER_WORDS, [
    [1, { buffer: 'manager' }],
    [at(0x29c), { buffer: 'figureVtable' }],
    [at(0x39c), item.reactions],
    [at(0xc84), item.driverFlags],
    [at(0xd04), item.racerFlags],
    [at(0xd7c), item.milliseconds],
    [at(0xd80), item.charge],
    [BODY_WORD, CAR_BODY_VTABLE],
    [BODY_WORD + at(0x5ec), getBitsFromFloat(item.drag)],
    [BODY_WORD + at(0x5f4), getBitsFromFloat(item.gripScale)],
    [BODY_WORD + at(0x608), getBitsFromFloat(item.topSpeed)],
    [BODY_WORD + at(0x628), getBitsFromFloat(item.throttle)],
    [BODY_WORD + at(0xc8), getBitsFromFloat(2)],
    [BODY_WORD + at(0x6c0), item.bodyFlags],
    [BODY_WORD + at(0x6e0), item.flaggedTimer],
    [BODY_WORD + at(0x730), getBitsFromFloat(item.topSpeedScale)],
    [BODY_WORD + at(0x744), item.isScripted ? 1 : 0],
    [BODY_WORD + at(0x778), getBitsFromFloat(item.speedFactor)],
    [BODY_WORD + at(0x7ec), getBitsFromFloat(item.target)],
  ])
}

// Everything these functions hand to code the port leaves out (the figure, the effect object, the vehicle's look) is
// replaced by a `ret` that cleans the arguments the caller pushed.
const PATCHES: readonly EmulatorPatch[] = [
  { address: 0x0040d550, bytes: [0xc2, 8, 0] },
  { address: 0x0040da30, bytes: [0xc2, 8, 0] },
  { address: 0x0040dad0, bytes: [0xc2, 4, 0] },
  { address: 0x00443bd0, bytes: [0x31, 0xc0, 0xc2, 4, 0] },
  { address: 0x00440100, bytes: [0xc2, 8, 0] },
  { address: 0x00440130, bytes: [0xc3] },
  { address: RETURN_THREE_ARGUMENTS_STUB, bytes: [0xc2, 0x0c, 0] },
  { address: RETURN_STUB, bytes: [0xc3] },
]

const getFigureBuffers = () => [
  {
    name: 'figureVtable',
    words: buildWords(0x60 / 4, [
      [0x54 / 4, RETURN_STUB],
      [0x58 / 4, RETURN_THREE_ARGUMENTS_STUB],
    ]),
    isRead: false,
  },
  { name: 'figure', words: buildWords(0xc0 / 4, [[0, { buffer: 'figureVtable' }]]), isRead: false },
  {
    name: 'giverFigure',
    words: buildWords(0xc0 / 4, [[0, { buffer: 'figureVtable' }]]),
    isRead: false,
  },
  { name: 'manager', words: new Array<number>(16).fill(0), isRead: false },
]

const getCall = (
  precision: EmulatorPrecision,
  address: number,
  item: EffectCase,
  giverMilliseconds: number
): EmulatorCall => ({
  address,
  convention: 'thiscall',
  precision,
  arguments:
    address === TRANSFER_ADDRESS
      ? [{ buffer: 'racer' }, { buffer: 'giverFigure' }, giverMilliseconds]
      : [{ buffer: 'racer' }],
  buffers: [{ name: 'racer', words: getRacerWords(item), isRead: true }, ...getFigureBuffers()],
  patches: PATCHES,
})

const getPortRacer = (item: EffectCase): Racer => {
  const racer = getRacer(createTestRacerSet(2), 0)
  return Object.freeze({
    ...racer,
    flags: item.racerFlags,
    timedEffectMilliseconds: item.milliseconds,
    timedEffectCharge: item.charge,
    driver: Object.freeze({ ...racer.driver, flags: item.driverFlags }),
    vehicle: Object.freeze({ ...racer.vehicle, reactionFlags: item.reactions }),
    carBody: Object.freeze({
      ...racer.carBody,
      isScripted: item.isScripted,
      speedFactor: item.speedFactor,
      targetSpeedFactor: item.target,
      topSpeedScale: item.topSpeedScale,
      rigidBody: Object.freeze({
        ...racer.carBody.rigidBody,
        flags: item.bodyFlags,
        flaggedTimer: item.flaggedTimer,
        throttle: item.throttle,
        gripScale: item.gripScale,
        topSpeed: item.topSpeed,
        drag: item.drag,
        mass: 2,
      }),
    }),
  })
}

const getOriginalBits = (words: readonly number[]): readonly number[] => {
  const at = (offset: number): number => words[offset / 4] ?? 0
  const body = (offset: number): number => at(0x3e8 + offset)
  return [
    at(0xd04),
    at(0xc84),
    at(0x39c),
    at(0xd7c),
    at(0xd80),
    body(0x6c0),
    body(0x6e0),
    body(0x778),
    body(0x7ec),
    body(0x608),
    body(0x5ec),
    body(0x5f4),
  ]
}

const getPortBits = (racer: Racer): readonly number[] => {
  const { carBody } = racer
  return [
    racer.flags,
    racer.driver.flags,
    racer.vehicle.reactionFlags,
    racer.timedEffectMilliseconds,
    racer.timedEffectCharge,
    carBody.rigidBody.flags,
    carBody.rigidBody.flaggedTimer,
    getBitsFromFloat(carBody.speedFactor),
    getBitsFromFloat(carBody.targetSpeedFactor),
    getBitsFromFloat(carBody.rigidBody.topSpeed),
    getBitsFromFloat(carBody.rigidBody.drag),
    getBitsFromFloat(carBody.rigidBody.gripScale),
  ].map((bits) => bits >>> 0)
}

const expectMatchesOriginal = async (
  precision: EmulatorPrecision,
  address: number,
  getPortResult: (arithmetic: FloatArithmetic, item: EffectCase) => Racer
): Promise<void> => {
  // Arrange
  const arithmetic = createFloatArithmetic(
    precision === 'single' ? FpuPrecision.SINGLE : FpuPrecision.DOUBLE
  )
  const sampler = createFloatSampler(createSeededRandom(address + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleEffectCase(sampler))
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(
    cases.map((item) => getCall(precision, address, item, item.giverMilliseconds))
  )
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const original = getOriginalBits(results[index]?.buffers['racer'] ?? [])
    const ported = getPortBits(getPortResult(arithmetic, item))
    const differing = original.flatMap((bits, position) =>
      getIsSameFloatBits(bits >>> 0, ported[position] ?? 0) ? [] : [position]
    )
    return differing.length === 0 ? [] : [`${String(index)}: outputs ${differing.join()}`]
  })

  // Assert
  expect(mismatches.slice(0, 8)).toEqual([])
}

const getRacerSet = (item: EffectCase, giverMilliseconds: number) => {
  const racerSet = createTestRacerSet(2)
  const giver = getRacer(racerSet, 1)
  return Object.freeze({
    ...racerSet,
    racers: Object.freeze([
      getPortRacer(item),
      Object.freeze({ ...giver, timedEffectMilliseconds: giverMilliseconds }),
    ]),
  })
}

describe.skipIf(!getIsEmulatorAvailable())('the timed effect against the original', () => {
  it.each(PRECISIONS)(
    '0x00439900 matches the original bit for bit in %s precision',
    (precision) =>
      expectMatchesOriginal(precision, TRANSFER_ADDRESS, (arithmetic, item) =>
        getRacer(
          transferTimedEffect(
            { ...createTestContext(), arithmetic },
            getRacerSet(item, item.giverMilliseconds),
            0,
            1
          ),
          0
        )
      ),
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it.each(PRECISIONS)(
    '0x00439b00 matches the original bit for bit in %s precision',
    (precision) =>
      expectMatchesOriginal(precision, END_ADDRESS, (arithmetic, item) =>
        getRacer(
          endTimedEffect({ ...createTestContext(), arithmetic }, getRacerSet(item, 0), 0, 0),
          0
        )
      ),
    TEST_TIMEOUT_IN_MILLISECONDS
  )

  it.each(PRECISIONS)(
    '0x004397b0 matches the original bit for bit in %s precision',
    (precision) =>
      expectMatchesOriginal(precision, END_CAR_BODY_ADDRESS, (arithmetic, item) =>
        getRacer(
          endCarBodyEffect({ ...createTestContext(), arithmetic }, getRacerSet(item, 0), 0, 0),
          0
        )
      ),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
})
