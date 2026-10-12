import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import { getCoverageRaces } from './render-coverage.ts'
import { runRenderComparison } from './render-comparison.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

// A demonstration lap of each race that scrolls a texture, at two frames (the offsets of GolDP.dll 0x10027f40 are a different
// phase at each). Without the scroll the textures' triangles differ in their texture coordinates: titwater 85 (frame 250),
// rktrans 29 (340), aaaamzon 45 (340), pswater 79 (250 and 340).
const SCROLL_CASES = [
  {
    name: 'Titan Station, water (hazard 0x36)',
    catalogName: 'tit',
    scrollingSources: ['titwater'],
    maximumMismatches: 0,
  },
  {
    name: 'Royal Knights, water (hazard 0x36)',
    catalogName: 'rkr',
    scrollingSources: ['rktrans'],
    maximumMismatches: 0,
  },
  {
    name: 'Amazon, falls (keyword 0x3f)',
    catalogName: 'ama',
    scrollingSources: ['aaawatr', 'aaaamzon'],
    maximumMismatches: 0,
  },
  // The untrusted frames of pswater: its racers leave the original's (golden-trace-computers.md), a corner is off by 0.37 px.
  {
    name: 'Pirate Pass, water',
    catalogName: 'psp',
    scrollingSources: ['pswater'],
    maximumMismatches: 3,
  },
]
const RECORD_FRAMES = [250, 340]

describe.skipIf(!isGamePresent())('texture scroll trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `it(...)`, not `it.each(...)(...)`
  it.each(SCROLL_CASES)('matches the scrolled textures of $name', async (scrollCase) => {
    // Arrange
    const race = getCoverageRaces(readOriginalJam()).find(
      (candidate) => candidate.catalogName === scrollCase.catalogName
    )

    // Act
    const result = await runRenderComparison({
      name: scrollCase.name,
      raceFolder: race?.raceFolder ?? '',
      racerCodes: race?.racerCodes ?? [],
      circuitName: race?.circuitName ?? '',
      isMirrored: race?.isMirrored ?? false,
      localPlayerCount: 0,
      frameCount: Math.max(...RECORD_FRAMES) + 1,
      recordFrames: RECORD_FRAMES,
      isRenderRecorded: true,
    })

    // Assert
    const mismatchCount = result.groups
      .filter(
        (group) =>
          group.kind === 'texture_coordinates' &&
          scrollCase.scrollingSources.some((source) => group.source.includes(source))
      )
      .reduce((total, group) => total + group.count, 0)
    expect(mismatchCount).toBeLessThanOrEqual(scrollCase.maximumMismatches)
  })
})
