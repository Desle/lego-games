import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorBuffer,
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import type { SeededRandom } from '../../../../shared/emulator/seeded-random.types.ts'
import { getIsOriginalExecutablePresent } from '../../../../shared/testing/original-files.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { TextRectangle } from '../../types/font-rendering.types.ts'
import {
  getFontBuffers,
  getFontCase,
  getUnsignedWord,
} from '../font-emulator-fixtures/font-emulator-fixtures.ts'
import type { FontCase } from '../font-emulator-fixtures/font-emulator-fixtures.types.ts'
import { layoutText } from './layout-text.ts'

const LAYOUT_TEXT_ADDRESS = 0x00408fe0
const CASE_COUNT = 300
const LOG_RECORD_CAPACITY = 160
const WORDS_PER_RECORD = 8

type LayoutCase = {
  readonly fontCase: FontCase
  readonly surfaceWidth: number
  readonly surfaceHeight: number
  readonly x: number
  readonly y: number
  readonly lineGap: number
  readonly clip: TextRectangle | null
  readonly alignment: 0 | 1
}

// x86 machine code the vtable slots of the font point at, so the draw calls leave a trace to read back:
// `blit` copies the two rectangles it receives into the log at [font + 0x2c] and counts them.
const BEGIN_STUB = [0xc2, 0x08, 0x00]
const SELECT_STUB = [0xc2, 0x04, 0x00]
const END_STUB = [0xc3]
const GET_DIMENSIONS_STUB = [0x8b, 0x41, 0x04, 0xc3]
const COPY_RECTANGLE = (sourceRegister: number, destinationOffset: number): number[] =>
  [0, 4, 8, 12]
    .flatMap((offset) => [
      offset === 0 ? [0x8b, sourceRegister] : [0x8b, sourceRegister | 0x40, offset],
      destinationOffset + offset === 0 ? [0x89, 0x0f] : [0x89, 0x4f, destinationOffset + offset],
    ])
    .flat()
const BLIT_STUB = [
  0x8b,
  0x44,
  0x24,
  0x04,
  0x8b,
  0x54,
  0x24,
  0x08,
  0x56,
  0x57,
  0x8b,
  0x71,
  0x2c,
  0x8b,
  0x3e,
  0xc1,
  0xe7,
  0x05,
  0x8d,
  0x7c,
  0x3e,
  0x04,
  ...COPY_RECTANGLE(0x08, 0),
  ...COPY_RECTANGLE(0x0a, 16),
  0xff,
  0x06,
  0x5f,
  0x5e,
  0xc2,
  0x08,
  0x00,
]

const getCodeWords = (bytes: readonly number[]): readonly number[] => {
  const words: number[] = []
  for (let index = 0; index < bytes.length; index += 4) {
    words.push(
      (bytes[index] ?? 0) |
        ((bytes[index + 1] ?? 0) << 8) |
        ((bytes[index + 2] ?? 0) << 16) |
        ((bytes[index + 3] ?? 0) << 24)
    )
  }
  return words.map(getUnsignedWord)
}

const getLayoutCase = (random: SeededRandom): LayoutCase => {
  const surfaceWidth = 100 + random.nextIntegerBelow(600)
  const surfaceHeight = 50 + random.nextIntegerBelow(350)
  const isClipped = random.nextIntegerBelow(2) === 0
  const left = random.nextIntegerBelow(surfaceWidth + 60) - 30
  const top = random.nextIntegerBelow(surfaceHeight + 40) - 20
  return {
    fontCase: getFontCase(random),
    surfaceWidth,
    surfaceHeight,
    x: random.nextIntegerBelow(320) - 20,
    y: random.nextIntegerBelow(220) - 20,
    lineGap: random.nextIntegerBelow(12) - 3,
    clip: isClipped
      ? {
          left,
          top,
          right: left + random.nextIntegerBelow(300) - 20,
          bottom: top + random.nextIntegerBelow(200) - 10,
        }
      : null,
    alignment: random.nextIntegerBelow(2) === 0 ? 0 : 1,
  }
}

// The stubs sit in the first scratch buffer, so they keep one address in every call and the emulator never
// executes a stale translation of another call's stub.
const STUB_OFFSETS = { begin: 0, select: 16, blit: 32, end: 160, getDimensions: 176 } as const

const getStubBlock = (): readonly number[] => {
  const bytes = new Array<number>(192).fill(0xcc)
  bytes.splice(STUB_OFFSETS.begin, BEGIN_STUB.length, ...BEGIN_STUB)
  bytes.splice(STUB_OFFSETS.select, SELECT_STUB.length, ...SELECT_STUB)
  bytes.splice(STUB_OFFSETS.blit, BLIT_STUB.length, ...BLIT_STUB)
  bytes.splice(STUB_OFFSETS.end, END_STUB.length, ...END_STUB)
  bytes.splice(STUB_OFFSETS.getDimensions, GET_DIMENSIONS_STUB.length, ...GET_DIMENSIONS_STUB)
  return getCodeWords(bytes)
}

const getStubBuffers = (layoutCase: LayoutCase): readonly EmulatorBuffer[] => [
  {
    name: 'vtable',
    words: [
      0,
      0,
      0,
      { buffer: 'stubs', offset: STUB_OFFSETS.begin },
      { buffer: 'stubs', offset: STUB_OFFSETS.select },
      { buffer: 'stubs', offset: STUB_OFFSETS.blit },
      { buffer: 'stubs', offset: STUB_OFFSETS.end },
    ],
    isRead: false,
  },
  { name: 'log', size: 4 + 4 * WORDS_PER_RECORD * LOG_RECORD_CAPACITY, isRead: true },
  { name: 'surface', words: [{ buffer: 'surfaceTable' }, { buffer: 'dimensions' }], isRead: false },
  {
    name: 'surfaceTable',
    words: [0, 0, 0, 0, 0, { buffer: 'stubs', offset: STUB_OFFSETS.getDimensions }],
    isRead: false,
  },
  {
    name: 'dimensions',
    words: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, layoutCase.surfaceWidth << 16, layoutCase.surfaceHeight],
    isRead: false,
  },
  {
    name: 'clip',
    words: [
      getUnsignedWord(layoutCase.clip?.left ?? 0),
      getUnsignedWord(layoutCase.clip?.top ?? 0),
      getUnsignedWord(layoutCase.clip?.right ?? 0),
      getUnsignedWord(layoutCase.clip?.bottom ?? 0),
    ],
    isRead: false,
  },
]

const getCall = (layoutCase: LayoutCase, precision: EmulatorPrecision): EmulatorCall => {
  const { fontCase } = layoutCase
  return {
    address: LAYOUT_TEXT_ADDRESS,
    convention: 'thiscall',
    precision,
    arguments: [
      { buffer: 'font' },
      { buffer: 'text' },
      { buffer: 'surface' },
      getUnsignedWord(layoutCase.x),
      getUnsignedWord(layoutCase.y),
      fontCase.maximumWidth,
      getUnsignedWord(layoutCase.lineGap),
      getBitsFromFloat(fontCase.scaleX),
      getBitsFromFloat(fontCase.scaleY),
      layoutCase.clip === null ? 0 : { buffer: 'clip' },
      0,
      layoutCase.alignment,
    ],
    buffers: [
      { name: 'stubs', words: getStubBlock(), isRead: false },
      ...getFontBuffers(fontCase, [{ buffer: 'vtable' }, { buffer: 'log' }]),
      ...getStubBuffers(layoutCase),
    ],
  }
}

const getOriginalRecords = (log: readonly number[]): readonly (readonly number[])[] => {
  const count = log[0] ?? 0
  return Array.from({ length: count }, (_, index) =>
    log
      .slice(1 + index * WORDS_PER_RECORD, 1 + (index + 1) * WORDS_PER_RECORD)
      .map((word) => word | 0)
  )
}

describe('layoutText against the original', () => {
  it.skipIf(!getIsEmulatorAvailable() || !getIsOriginalExecutablePresent())(
    'places the same glyph rectangles as 0x00408fe0 and 0x00409300 in both precisions',
    async () => {
      // Arrange
      const random = createSeededRandom(0x1a4007)
      const layoutCases = Array.from({ length: CASE_COUNT }, () => getLayoutCase(random))
      const session = openEmulatorSession()

      // Act
      const mismatches: string[] = []
      let drawnGlyphCount = 0
      for (const precision of [FpuPrecision.SINGLE, FpuPrecision.DOUBLE]) {
        const results = await session.callBatch(
          layoutCases.map((layoutCase) => getCall(layoutCase, precision))
        )
        const arithmetic = createFloatArithmetic(precision)
        layoutCases.forEach((layoutCase, caseIndex) => {
          const { fontCase } = layoutCase
          const commands = layoutText({
            font: fontCase.font,
            text: fontCase.text,
            surface: { width: layoutCase.surfaceWidth, height: layoutCase.surfaceHeight },
            x: layoutCase.x,
            y: layoutCase.y,
            maximumWidth: fontCase.maximumWidth,
            lineGap: layoutCase.lineGap,
            scale: { x: fontCase.scaleX, y: fontCase.scaleY },
            clip: layoutCase.clip,
            alignment: layoutCase.alignment === 1 ? 'center' : 'left',
            arithmetic,
          })
          const port = commands.map((command) => [
            command.sourceX,
            command.sourceY,
            command.sourceX + command.sourceWidth,
            command.sourceY + command.sourceHeight,
            command.destination.left,
            command.destination.top,
            command.destination.right,
            command.destination.bottom,
          ])
          const original = getOriginalRecords(results[caseIndex]?.buffers['log'] ?? [])
          drawnGlyphCount += original.length
          if (JSON.stringify(original) !== JSON.stringify(port)) {
            mismatches.push(
              `${precision} case ${String(caseIndex)}: ${JSON.stringify(original.slice(0, 3))} vs ${JSON.stringify(port.slice(0, 3))}`
            )
          }
        })
      }
      await session.close()

      // Assert
      expect(mismatches.slice(0, 4)).toEqual([])
      expect(drawnGlyphCount).toBeGreaterThan(1000)
    },
    120_000
  )
})
