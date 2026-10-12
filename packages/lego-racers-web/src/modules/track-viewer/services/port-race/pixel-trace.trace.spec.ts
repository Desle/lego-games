import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runPixelComparison } from './pixel-comparison.ts'
import type { PixelFrameResult, PixelTraceBrowser } from './pixel-comparison.types.ts'
import { getChromePath, startPixelTraceBrowser } from './pixel-trace-browser.ts'
import type { PixelTraceCase } from './pixel-trace-cases.types.ts'
import { PIXEL_TRACE_CASES } from './pixel-trace-cases.ts'

const chromePath = getChromePath()
const isAvailable = () =>
  getIsOriginalGamePresent() && getIsOriginalPresentationAvailable() && chromePath !== null
const TOLERANCE = Object.freeze({ channelLevels: 32 })
const PERCENT = 100

const describeFrame = (result: PixelFrameResult): string =>
  [
    `frame ${String(result.frame)}: ${(result.comparison.differingShare * PERCENT).toFixed(2)}% differ`,
    `  textures ${result.comparison.textureCoverages
      .slice(0, 5)
      .map(
        (coverage) =>
          `${coverage.label} ${String(coverage.differingCount)}/${String(coverage.pixelCount)}`
      )
      .join(', ')}`,
    ...result.comparison.regions.map(
      (region) =>
        `  region x ${String(region.left)}-${String(region.right)} y ${String(region.top)}-${String(region.bottom)} ` +
        `${String(region.differingCount)} px, original ${region.meanReference.join(',')} port ${region.meanPort.join(',')}:${region.dominantTextures.map((texture) => `${texture.label} ${String(texture.count)}`).join(', ')}`
    ),
  ].join('\n')

const getWatchedShare = (results: readonly PixelFrameResult[], label: string): number => {
  const coverages = results.flatMap((result) =>
    result.comparison.textureCoverages.filter((coverage) => coverage.label === label)
  )
  const pixelCount = coverages.reduce((total, coverage) => total + coverage.pixelCount, 0)
  const differingCount = coverages.reduce((total, coverage) => total + coverage.differingCount, 0)
  return pixelCount === 0 ? Number.NaN : differingCount / pixelCount
}

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
      const worst = Math.max(...results.map((result) => result.comparison.differingShare))
      expect(worst).toBeLessThanOrEqual(pixelCase.maximumDifferingShare)
      for (const watched of pixelCase.watchedTextures) {
        expect(getWatchedShare(results, watched.label), watched.label).toBeLessThanOrEqual(
          watched.maximumDifferingShare
        )
      }
    }
  )
})
