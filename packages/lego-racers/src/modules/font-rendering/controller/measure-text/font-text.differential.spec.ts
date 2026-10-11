import {
  getIsEmulatorAvailable,
  openEmulatorSession,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  EmulatorCall,
  EmulatorPrecision,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import { createSeededRandom } from '../../../../shared/emulator/seeded-random.ts'
import { getIsOriginalExecutablePresent } from '../../../../shared/testing/original-files.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  getFontBuffers,
  getFontCase,
  getUnsignedWord,
} from '../font-emulator-fixtures/font-emulator-fixtures.ts'
import type { FontCase } from '../font-emulator-fixtures/font-emulator-fixtures.types.ts'
import { getGlyphIndex } from '../get-glyph-index/get-glyph-index.ts'
import { getTextWidth } from './get-text-width.ts'
import { getWrappedTextSize } from './get-wrapped-text-size.ts'

const GET_TEXT_WIDTH_ADDRESS = 0x00408be0
const GET_WRAPPED_TEXT_SIZE_ADDRESS = 0x00408d50
const GET_GLYPH_INDEX_ADDRESS = 0x004092b0
const CASE_COUNT = 400

const getCalls = (
  fontCases: readonly FontCase[],
  precision: EmulatorPrecision
): readonly EmulatorCall[] =>
  fontCases.flatMap((fontCase) => {
    const buffers = getFontBuffers(fontCase, [])
    const base = { convention: 'thiscall', precision, buffers } as const
    return [
      {
        ...base,
        address: GET_TEXT_WIDTH_ADDRESS,
        arguments: [
          { buffer: 'font' },
          { buffer: 'text' },
          { buffer: 'output' },
          { buffer: 'output', offset: 4 },
        ],
      },
      {
        ...base,
        address: GET_WRAPPED_TEXT_SIZE_ADDRESS,
        arguments: [
          { buffer: 'font' },
          { buffer: 'text' },
          fontCase.maximumWidth,
          getUnsignedWord(fontCase.firstLineOffset),
          getBitsFromFloat(fontCase.scaleX),
          getBitsFromFloat(fontCase.scaleY),
          { buffer: 'output' },
          { buffer: 'output', offset: 4 },
        ],
      },
      {
        ...base,
        address: GET_GLYPH_INDEX_ADDRESS,
        arguments: [{ buffer: 'font' }, fontCase.probeCode],
      },
    ]
  })

describe('font text routines against the original', () => {
  it.skipIf(!getIsEmulatorAvailable() || !getIsOriginalExecutablePresent())(
    'measure, wrap-measure and look up glyphs like 0x00408be0, 0x00408d50 and 0x004092b0 in both precisions',
    async () => {
      // Arrange
      const random = createSeededRandom(0x7e57)
      const fontCases = Array.from({ length: CASE_COUNT }, () => getFontCase(random))
      const session = openEmulatorSession()

      // Act
      const mismatches: string[] = []
      for (const precision of [FpuPrecision.SINGLE, FpuPrecision.DOUBLE]) {
        const results = await session.callBatch(getCalls(fontCases, precision))
        const arithmetic = createFloatArithmetic(precision)
        fontCases.forEach((fontCase, caseIndex) => {
          const [widthResult, wrappedResult, indexResult] = results.slice(
            caseIndex * 3,
            caseIndex * 3 + 3
          )
          const size = getTextWidth(fontCase.font, fontCase.text)
          const wrapped = getWrappedTextSize({
            font: fontCase.font,
            text: fontCase.text,
            maximumWidth: fontCase.maximumWidth,
            firstLineOffset: fontCase.firstLineOffset,
            scale: { x: fontCase.scaleX, y: fontCase.scaleY },
            arithmetic,
          })
          const original = {
            width: widthResult?.buffers['output'],
            wrapped: wrappedResult?.buffers['output'],
            index: indexResult?.eax,
          }
          const port = {
            width: [size.width, size.height],
            wrapped: [wrapped.width, wrapped.height],
            index: getGlyphIndex(fontCase.font, fontCase.probeCode),
          }
          const isSame =
            JSON.stringify(original.width) === JSON.stringify(port.width) &&
            JSON.stringify(original.wrapped) === JSON.stringify(port.wrapped) &&
            original.index === port.index
          if (!isSame) {
            mismatches.push(
              `${precision} case ${String(caseIndex)}: ${JSON.stringify(original)} vs ${JSON.stringify(port)}`
            )
          }
        })
      }
      await session.close()

      // Assert
      expect(mismatches.slice(0, 5)).toEqual([])
    },
    120_000
  )
})
