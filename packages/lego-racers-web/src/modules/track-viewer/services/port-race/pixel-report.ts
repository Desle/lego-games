import type { PixelFrameResult } from './pixel-comparison.types.ts'

const PERCENT = 100
const TEXTURE_LISTING_COUNT = 5

export const describeFrame = (result: PixelFrameResult): string =>
  [
    `frame ${String(result.frame)}: ${(result.comparison.differingShare * PERCENT).toFixed(2)}% differ`,
    `  textures ${result.comparison.textureCoverages
      .slice(0, TEXTURE_LISTING_COUNT)
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

export const getWorstShare = (results: readonly PixelFrameResult[]): number =>
  Math.max(...results.map((result) => result.comparison.differingShare))

export const getWatchedShare = (results: readonly PixelFrameResult[], label: string): number => {
  const coverages = results.flatMap((result) =>
    result.comparison.textureCoverages.filter((coverage) => coverage.label === label)
  )
  const pixelCount = coverages.reduce((total, coverage) => total + coverage.pixelCount, 0)
  const differingCount = coverages.reduce((total, coverage) => total + coverage.differingCount, 0)
  return pixelCount === 0 ? Number.NaN : differingCount / pixelCount
}
