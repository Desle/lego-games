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
import { createFloatArithmetic } from '../../../simulation-math/index.ts'
import type { BrickPiece, CarDesign, PlacedBrick } from '../../types/car-builder.types.ts'
import { createBuildGrid } from '../build-grid/build-grid.ts'
import { getCarWeight } from './get-car-weight.ts'

const WEIGHT_ADDRESS = 0x0049c6a0
const CASE_COUNT = 1000
const PRECISIONS: readonly EmulatorPrecision[] = ['single', 'double']
const TEST_TIMEOUT_IN_MILLISECONDS = 120_000
const BUILDER_WORDS = 64

const sampleCell = (sampler: FloatSampler): readonly [number, number] => {
  const top = sampler.sampleIntegerBelow(8)
  const bottom = sampler.getIsChance(60) ? 0 : sampler.sampleIntegerBelow(9)
  return [top | (sampler.getIsChance(30) ? 0x80 : 0), bottom | (sampler.getIsChance(30) ? 0x80 : 0)]
}

const sampleBrick = (sampler: FloatSampler): PlacedBrick => {
  const width = 1 + sampler.sampleIntegerBelow(4)
  const height = 1 + sampler.sampleIntegerBelow(4)
  const cells = Uint8Array.from(
    Array.from({ length: width * height }, () => sampleCell(sampler)).flat()
  )
  const piece: BrickPiece = {
    name: 'test',
    id: sampler.getIsChance(80)
      ? 0x800 + sampler.sampleIntegerBelow(0x1000)
      : sampler.sampleIntegerBelow(0x800),
    footprint: { width, height, cells, originVertexIndex: 0 },
    faceRecordCount: 0,
    geometryOffset: 0,
    variantIndex: 0,
    variantCount: 1,
  }
  return {
    piece,
    x: sampler.sampleIntegerBelow(8),
    y: sampler.sampleIntegerBelow(4),
    orientation: sampler.sampleIntegerBelow(4),
    colorIndex: 0,
    unidentifiedValue: 0,
    baseHeight: sampler.sampleIntegerBelow(12),
  }
}

const getFootprintBytes = (brick: PlacedBrick): readonly number[] => {
  const { footprint } = brick.piece
  return [footprint.width, footprint.height, ...footprint.cells, 0, 0]
}

const getWords = (bytes: readonly number[]): readonly number[] =>
  Array.from({ length: Math.ceil(bytes.length / 4) }, (_, word) =>
    bytes
      .slice(word * 4, word * 4 + 4)
      .reduce((value, byte, index) => (value | (byte << (index * 8))) >>> 0, 0)
  )

const getCall = (precision: EmulatorPrecision, bricks: readonly PlacedBrick[]): EmulatorCall => {
  const entryWords: EmulatorArgument[] = bricks.flatMap((brick, index) => [
    { buffer: `piece${String(index)}` },
    0,
    0,
    brick.orientation,
    brick.x,
    brick.y,
    brick.baseHeight,
  ])
  const builderWords: EmulatorArgument[] = Array.from({ length: BUILDER_WORDS }, () => 0)
  builderWords[0xac / 4] = bricks.length
  builderWords[0xb0 / 4] = { buffer: 'entries' }
  return {
    address: WEIGHT_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [
      { buffer: 'builder' },
      { buffer: 'out', offset: 0 },
      { buffer: 'out', offset: 4 },
      { buffer: 'out', offset: 8 },
    ],
    buffers: [
      { name: 'builder', words: builderWords, isRead: false },
      { name: 'entries', words: entryWords.length === 0 ? [0] : entryWords, isRead: false },
      { name: 'out', words: [0, 0, 0], isRead: true },
      ...bricks.flatMap((brick, index) => [
        {
          name: `piece${String(index)}`,
          words: [0, 0, 0, 0, { buffer: `footprint${String(index)}` }, brick.piece.id],
          isRead: false,
        },
        {
          name: `footprint${String(index)}`,
          words: getWords(getFootprintBytes(brick)),
          isRead: false,
        },
      ]),
    ],
  }
}

const getPortOutput = (
  arithmetic: ReturnType<typeof createFloatArithmetic>,
  bricks: readonly PlacedBrick[]
): readonly number[] => {
  const design: CarDesign = { bricks, grid: createBuildGrid() }
  const weight = getCarWeight(arithmetic, design)
  return [weight.centreOffsetX, weight.centreOffsetY, weight.centreHeight].map(getBitsFromFloat)
}

const expectMatchesOriginal = async (precision: EmulatorPrecision): Promise<void> => {
  // Arrange
  const sampler = createFloatSampler(createSeededRandom(0x49c6a0 + precision.length))
  const cases = Array.from({ length: CASE_COUNT }, () =>
    Array.from({ length: sampler.sampleIntegerBelow(7) }, () => sampleBrick(sampler))
  )
  const arithmetic = createFloatArithmetic(precision)
  const session = openEmulatorSession()

  // Act
  const results = await session.callBatch(cases.map((bricks) => getCall(precision, bricks)))
  await session.close()

  // Assert
  const mismatches = cases.flatMap((bricks, index) => {
    const original = results[index]?.buffers['out'] ?? []
    const port = getPortOutput(arithmetic, bricks)
    const isSame =
      original.length === port.length &&
      original.every((bits, position) => getIsSameFloatBits(bits, port[position] ?? 0))
    return isSame ? [] : [index]
  })
  expect(mismatches).toEqual([])
}

describe.skipIf(!getIsEmulatorAvailable())('the car weight against the original', () =>
  it.each(PRECISIONS)(
    '0x0049c6a0 matches the original bit for bit in %s precision',
    (precision) => expectMatchesOriginal(precision),
    TEST_TIMEOUT_IN_MILLISECONDS
  )
)
