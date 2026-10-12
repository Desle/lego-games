import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runPixelComparison } from './pixel-comparison.ts'
import type { PixelTraceBrowser } from './pixel-comparison.types.ts'
import { describeFrame, getWatchedShare, getWorstShare } from './pixel-report.ts'
import { getChromePath, startPixelTraceBrowser } from './pixel-trace-browser.ts'
import type { PixelTraceCase } from './pixel-trace-cases.types.ts'
import { PIXEL_TRACE_CASES } from './pixel-trace-cases.ts'

const chromePath = getChromePath()
const isAvailable = () =>
  getIsOriginalGamePresent() && getIsOriginalPresentationAvailable() && chromePath !== null
const TOLERANCE = Object.freeze({ channelLevels: 32 })

describe.skipIf(!isAvailable())('pixel trace', () => {
  let browser: PixelTraceBrowser | null = null
  beforeAll(async () => {
    if (chromePath !== null) browser = await startPixelTraceBrowser(chromePath)
  })
  afterAll(async () => {
    await browser?.close()
  })

  it.each(PIXEL_TRACE_CASES)(
    'compares the pixels of $request.name',
    async (pixelCase: PixelTraceCase) => {
      // Arrange
      if (browser === null) throw new Error('No browser')

      // Act
      const results = await runPixelComparison(
        browser,
        pixelCase.request,
        TOLERANCE,
        process.env['PIXEL_TRACE_DUMP'] ?? null
      )

      // Assert
      console.log(`${pixelCase.request.name}\n${results.map(describeFrame).join('\n')}`)
      expect(getWorstShare(results)).toBeLessThanOrEqual(pixelCase.maximumDifferingShare)
      for (const watched of pixelCase.watchedTextures) {
        expect(getWatchedShare(results, watched.label), watched.label).toBeLessThanOrEqual(
          watched.maximumDifferingShare
        )
      }
    }
  )
})
