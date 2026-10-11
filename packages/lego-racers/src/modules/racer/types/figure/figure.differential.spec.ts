import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorArgument,
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat, getIsSameFloatBits } from '../../../../shared/emulator/float-bits.ts'
import {
  createFloatSampler,
  createSeededRandom,
} from '../../../../shared/emulator/seeded-random.ts'
import type { FloatSampler } from '../../../../shared/emulator/seeded-random.types.ts'
import { getBoundingInterval, getBoundingSphere } from '../../../racer-collision/index.ts'
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Matrix3 } from '../../../simulation-math/index.ts'
import type { Figure, FigureAnimation } from '../racer.types.ts'
import { createFigure, getFigureBounds, updateFigure } from './figure.ts'

const FIGURE_VTABLE = 0x004af5ec
const BOUNDS_ADDRESS = 0x0040e0b0
const UPDATE_ADDRESS = 0x0040dd60
const FIGURE_WORDS = 64
const RECORD_WORDS = 10
const CASE_COUNT = 1000
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000

type Entry = readonly [number, EmulatorArgument]

type FigureCase = {
  readonly flags: number
  readonly currentId: number
  readonly targetId: number
  readonly currentTime: number
  readonly currentRate: number
  readonly targetTime: number
  readonly targetRate: number
  readonly blend: number
  readonly blendRate: number
  readonly isCurrentAdvancing: boolean
  readonly isTargetAdvancing: boolean
  readonly vectors: readonly number[]
  readonly scale: number
  readonly animations: readonly FigureAnimation[]
  readonly childCentre: readonly number[]
  readonly childRadius: number
  readonly childScale: number
  readonly rotation: Matrix3
  readonly position: readonly number[]
  readonly step: number
}

const buildWords = (length: number, entries: readonly Entry[]): readonly EmulatorArgument[] => {
  const lookup = new Map(entries)
  return Array.from({ length }, (_, index) => lookup.get(index) ?? 0)
}

const getFloatEntries = (word: number, values: readonly number[]): readonly Entry[] =>
  values.map((value, index): Entry => [word + index, getBitsFromFloat(value)])

const sampleChoice = (sampler: FloatSampler, ...values: readonly number[]): number =>
  values[sampler.sampleIntegerBelow(values.length)] ?? 0

const sampleVector = (sampler: FloatSampler, limit: number): readonly number[] =>
  Array.from({ length: 3 }, () => sampler.sampleUniform(limit))

const sampleAnimation = (sampler: FloatSampler): FigureAnimation => {
  const [x, y, z] = sampleVector(sampler, 2) as [number, number, number]
  const [cx, cy, cz] = sampleVector(sampler, 1) as [number, number, number]
  return {
    rate: Math.abs(sampler.sampleUniform(0.1)),
    vector: { x, y, z },
    boundsCentre: { x: cx, y: cy, z: cz },
    boundsRadius: Math.fround(1 + Math.abs(sampler.sampleUniform(2))),
    frameCount: sampleChoice(sampler, 5, 20, 60),
    period: sampleChoice(sampler, 4, 19, 59),
  }
}

const sampleRotation = (sampler: FloatSampler): Matrix3 => {
  const angle = sampler.sampleAngle(6.3)
  const [cosine, sine] = [Math.cos(angle), Math.sin(angle)]
  return [cosine, sine, 0, -sine, cosine, 0, 0, 0, 1].map(Math.fround) as unknown as Matrix3
}

const sampleCase = (sampler: FloatSampler): FigureCase => ({
  flags: sampleChoice(
    sampler,
    0,
    0x10000,
    0x10000,
    0x10000 | 0x20000,
    0x10000 | 0x20000,
    0x10000 | 0x40000,
    0x10000 | 0x20000 | 0x40000 | 0x400000,
    0x10000 | 0x100000,
    0x10000 | 0x20000 | 0x400000
  ),
  currentId: sampler.sampleIntegerBelow(3),
  targetId: sampler.sampleIntegerBelow(3),
  currentTime: Math.abs(sampler.sampleUniform(30)),
  currentRate: Math.abs(sampler.sampleUniform(0.1)),
  targetTime: Math.abs(sampler.sampleUniform(30)),
  targetRate: Math.abs(sampler.sampleUniform(0.1)),
  blend: Math.abs(sampler.sampleUniform(1)),
  blendRate: Math.fround(0.0033333333),
  isCurrentAdvancing: sampler.getIsChance(70),
  isTargetAdvancing: sampler.getIsChance(70),
  vectors: sampleVector(sampler, 3).concat(sampleVector(sampler, 3), sampleVector(sampler, 3)),
  scale: sampleChoice(sampler, 1, 1, Math.fround(0.8)),
  animations: Array.from({ length: 3 }, () => sampleAnimation(sampler)),
  childCentre: sampleVector(sampler, 1),
  childRadius: Math.fround(1 + Math.abs(sampler.sampleUniform(2))),
  childScale: Math.fround(0.5 + Math.abs(sampler.sampleUniform(1))),
  rotation: sampleRotation(sampler),
  position: sampleVector(sampler, 20),
  step: sampleChoice(sampler, 1, 16, 40, 100, 300, 500),
})

const getFigureWords = (item: FigureCase): readonly EmulatorArgument[] =>
  buildWords(FIGURE_WORDS, [
    [0, FIGURE_VTABLE],
    ...getFloatEntries(0x1c / 4, item.vectors.slice(6, 9)),
    ...getFloatEntries(0x28 / 4, item.rotation),
    ...getFloatEntries(0x4c / 4, item.position),
    ...getFloatEntries(0x58 / 4, [item.scale]),
    [0x5c / 4, item.flags],
    [0x78 / 4, { buffer: 'child' }],
    [0xa8 / 4, { buffer: 'set' }],
    ...getFloatEntries(0xb4 / 4, [item.currentTime, item.currentRate]),
    [0xbc / 4, item.currentId],
    ...getFloatEntries(0xc0 / 4, item.vectors.slice(0, 3)),
    [0xcc / 4, item.isCurrentAdvancing ? 1 : 0],
    ...getFloatEntries(0xd0 / 4, [item.targetTime, item.targetRate]),
    [0xd8 / 4, item.targetId],
    ...getFloatEntries(0xdc / 4, item.vectors.slice(3, 6)),
    [0xe8 / 4, item.isTargetAdvancing ? 1 : 0],
    ...getFloatEntries(0xec / 4, [item.blend, item.blendRate]),
  ])

const getRecordWords = (animations: readonly FigureAnimation[]): readonly EmulatorArgument[] =>
  animations.flatMap((animation) =>
    buildWords(RECORD_WORDS, [
      ...getFloatEntries(0, [animation.rate]),
      ...getFloatEntries(1, [animation.vector.x, animation.vector.y, animation.vector.z]),
      ...getFloatEntries(4, [
        animation.boundsCentre.x,
        animation.boundsCentre.y,
        animation.boundsCentre.z,
        animation.boundsRadius,
      ]),
      [9, animation.frameCount | (animation.period << 16)],
    ])
  )

const getBuffers = (item: FigureCase, isRead: boolean) => [
  { name: 'figure', words: getFigureWords(item), isRead },
  {
    name: 'child',
    words: buildWords(16, [
      ...getFloatEntries(0x28 / 4, item.childCentre),
      ...getFloatEntries(0x34 / 4, [item.childRadius, item.childScale]),
    ]),
    isRead: false,
  },
  { name: 'set', words: buildWords(16, [[0x2c / 4, { buffer: 'records' }]]), isRead: false },
  { name: 'records', words: getRecordWords(item.animations), isRead: false },
]

const getCall = (
  precision: EmulatorPrecision,
  address: number,
  item: FigureCase,
  stackArguments: readonly EmulatorArgument[]
): EmulatorCall => ({
  address,
  convention: 'thiscall',
  precision,
  arguments: [{ buffer: 'figure' }, ...stackArguments],
  buffers: getBuffers(item, true),
})

const getPortFigure = (item: FigureCase): Figure => {
  const [cx, cy, cz] = item.childCentre as [number, number, number]
  return {
    ...createFigure(item.animations, {
      centre: { x: cx, y: cy, z: cz },
      radius: item.childRadius,
      radiusScale: item.childScale,
    }),
    flags: item.flags,
    currentId: item.currentId,
    targetId: item.targetId,
    currentTime: item.currentTime,
    currentRate: item.currentRate,
    targetTime: item.targetTime,
    targetRate: item.targetRate,
    blend: item.blend,
    blendRate: item.blendRate,
    isCurrentAdvancing: item.isCurrentAdvancing,
    isTargetAdvancing: item.isTargetAdvancing,
    currentVector: { x: item.vectors[0] ?? 0, y: item.vectors[1] ?? 0, z: item.vectors[2] ?? 0 },
    targetVector: { x: item.vectors[3] ?? 0, y: item.vectors[4] ?? 0, z: item.vectors[5] ?? 0 },
    outputVector: { x: item.vectors[6] ?? 0, y: item.vectors[7] ?? 0, z: item.vectors[8] ?? 0 },
    scale: item.scale,
  }
}

const getWords = (value: readonly number[], start: number, count: number): readonly number[] =>
  value.slice(start, start + count)

const getFigureOutput = (figure: Figure): readonly number[] => [
  figure.flags >>> 0,
  figure.currentId,
  figure.targetId,
  ...[
    figure.currentTime,
    figure.currentRate,
    figure.targetTime,
    figure.blend,
    figure.outputVector.x,
    figure.outputVector.y,
    figure.outputVector.z,
    figure.currentVector.x,
    figure.currentVector.y,
    figure.currentVector.z,
  ].map(getBitsFromFloat),
]

const getOriginalFigureOutput = (words: readonly number[]): readonly number[] => [
  words[0x5c / 4] ?? 0,
  (words[0xbc / 4] ?? 0) & 0xffff,
  (words[0xd8 / 4] ?? 0) & 0xffff,
  ...getWords(words, 0xb4 / 4, 1),
  ...getWords(words, 0xb8 / 4, 1),
  ...getWords(words, 0xd0 / 4, 1),
  ...getWords(words, 0xec / 4, 1),
  ...getWords(words, 0x1c / 4, 3),
  ...getWords(words, 0xc0 / 4, 3),
]

const getIsSameWords = (original: readonly number[], port: readonly number[]): boolean =>
  original.length === port.length &&
  original.every((bits, index) => getIsSameFloatBits(bits, port[index] ?? 0))

const getWorldSphere = (arithmetic: FloatArithmetic, item: FigureCase) => {
  const bounds = getFigureBounds(arithmetic, getPortFigure(item))
  return bounds === null
    ? null
    : getBoundingSphere(
        arithmetic,
        {
          rotation: item.rotation,
          position: {
            x: item.position[0] ?? 0,
            y: item.position[1] ?? 0,
            z: item.position[2] ?? 0,
          },
        },
        bounds.centre,
        bounds.radius
      )
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x40e0 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () => sampleCase(sampler))
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const boundsResults = await session.callBatch(
    cases.map((item) => getCall(precision, BOUNDS_ADDRESS, item, [0]))
  )
  const updateResults = await session.callBatch(
    cases.map((item) => getCall(precision, UPDATE_ADDRESS, item, [item.step]))
  )
  await session.close()
  const mismatches = cases.flatMap((item, index) => {
    const sphere = getWorldSphere(arithmetic, item)
    const original = boundsResults[index]?.buffers['figure'] ?? []
    const interval = sphere === null ? null : getBoundingInterval(arithmetic, sphere)
    const originalBounds = [...getWords(original, 1, 3), ...getWords(original, 4, 3)]
    const portBounds =
      sphere === null || interval === null
        ? [0, 0, 0, 0, 0, 0]
        : [
            sphere.centre.x,
            sphere.centre.y,
            sphere.centre.z,
            sphere.radius,
            interval.minimum,
            interval.maximum,
          ].map(getBitsFromFloat)
    const isBoundsSame = sphere === null || getIsSameWords(originalBounds, portBounds)
    const updated = updateFigure(arithmetic, getPortFigure(item), item.step)
    const isUpdateSame = getIsSameWords(
      getOriginalFigureOutput(updateResults[index]?.buffers['figure'] ?? []),
      getFigureOutput(updated)
    )
    return isBoundsSame && isUpdateSame ? [] : [index]
  })

  // Assert
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('figures against the original', () =>
  it.each(PRECISIONS)(
    '0x0040e0b0 and 0x0040dd60 match the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)
