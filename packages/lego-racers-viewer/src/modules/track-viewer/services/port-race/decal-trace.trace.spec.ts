import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runDecalComparison } from './decal-comparison.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

const getFrames = (first: number, last: number, step: number): readonly number[] =>
  Array.from({ length: Math.ceil((last - first) / step) + 1 }, (_, index) => first + index * step)

type DecalCase = TraceScenarioRequest & { readonly expectedCount: number }

// The decals are projected whether or not the camera sees them, so these cases need no view of them: an oil slick the
// player drops, and the scars of a barrel that bursts on the ground three times (the burst starts at frames 387, 402
// and 418; a scar grows for 30 frames and fades for 150).
const DECAL_CASES: readonly DecalCase[] = [
  {
    name: 'oil slick',
    raceFolder: 'RACEC0R0',
    powerUp: { kind: 4, level: 0, grantFrame: 300, useFrame: 305, frameCount: 420 },
    recordFrames: [305, 306, 307, 310, 330, 380, 415],
    expectedCount: 1,
  },
  {
    name: 'barrel scars',
    raceFolder: 'RACEC0R0',
    powerUp: { kind: 4, level: 1, grantFrame: 300, useFrame: 305, frameCount: 580 },
    recordFrames: getFrames(386, 574, 3),
    expectedCount: 3,
  },
  {
    name: 'crane shadow',
    raceFolder: 'RACEC0R1',
    isSteering: true,
    recordFrames: getFrames(386, 430, 2),
    expectedCount: 1,
  },
]

describe.skipIf(!isGamePresent())('decal trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `it(...)`, not `it.each(...)(...)`
  it.each(DECAL_CASES)('holds the original triangles in $name', async (decalCase) => {
    // Arrange / Act
    const frames = await runDecalComparison(decalCase)

    // Assert
    const failures = frames
      .filter(
        (frame) => frame.matchedCount !== frame.portCount || frame.unmatchedOriginals.length > 0
      )
      .map(
        (frame) =>
          `frame ${String(frame.frame)}: port ${String(frame.portCount)} matched ${String(frame.matchedCount)} unmatched originals ${frame.unmatchedOriginals.join(',')}`
      )
    expect(frames.length).toBe(decalCase.recordFrames?.length)
    expect(failures).toEqual([])
    expect(Math.max(...frames.map((frame) => frame.portCount))).toBe(decalCase.expectedCount)
  })
})
