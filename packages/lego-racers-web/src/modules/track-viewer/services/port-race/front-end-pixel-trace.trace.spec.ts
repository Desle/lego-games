import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { runFrontEndPixelComparison } from './front-end-pixel-comparison.ts'
import { FRONT_END_PIXEL_CASES } from './front-end-pixel-cases.ts'
import type { FrontEndPixelCase } from './front-end-pixel-cases.types.ts'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import type { PixelTraceBrowser } from './pixel-comparison.types.ts'
import { describeFrame, getWorstShare } from './pixel-report.ts'
import { getChromePath, startPixelTraceBrowser } from './pixel-trace-browser.ts'

const chromePath = getChromePath()
const isAvailable = () =>
  getIsOriginalGamePresent() && getIsOriginalPresentationAvailable() && chromePath !== null
const TOLERANCE = Object.freeze({ channelLevels: 32 })

describe.skipIf(!isAvailable())('front end pixel trace', () => {
  let browser: PixelTraceBrowser | null = null
  beforeAll(async () => {
    if (chromePath !== null) browser = await startPixelTraceBrowser(chromePath)
  })
  afterAll(async () => {
    await browser?.close()
  })

  it.each(FRONT_END_PIXEL_CASES)(
    'compares the pixels of $name',
    async (pixelCase: FrontEndPixelCase) => {
      // Arrange
      if (browser === null) throw new Error('No browser')

      // Act
      const results = await runFrontEndPixelComparison(
        browser,
        pixelCase,
        TOLERANCE,
        process.env['PIXEL_TRACE_DUMP'] ?? null
      )

      // Assert
      console.log(`${pixelCase.name}\n${results.map(describeFrame).join('\n')}`)
      expect(getWorstShare(results)).toBeLessThanOrEqual(pixelCase.maximumDifferingShare)
    }
  )
})
