import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runRenderComparison } from './render-comparison.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

const RECORD_FRAMES = [5, 100, 170, 250, 320]
const RENDER_CASES: readonly TraceScenarioRequest[] = [
  { name: 'Royal Knights', raceFolder: 'RACEC0R0', recordFrames: RECORD_FRAMES },
  {
    name: 'Royal Knights, mirrored',
    raceFolder: 'RACEC0R0',
    isMirrored: true,
    recordFrames: RECORD_FRAMES,
  },
  { name: 'RACEC0R1', raceFolder: 'RACEC0R1', recordFrames: RECORD_FRAMES },
  { name: 'RACEC0R2', raceFolder: 'RACEC0R2', recordFrames: RECORD_FRAMES },
  { name: 'RACEC0R3', raceFolder: 'RACEC0R3', recordFrames: RECORD_FRAMES },
  { name: 'RACEC1R0', raceFolder: 'RACEC1R0', recordFrames: RECORD_FRAMES },
  { name: 'RACEC3R0', raceFolder: 'RACEC3R0', recordFrames: RECORD_FRAMES },
]

describe.skipIf(!isGamePresent())('render trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `it(...)`, not `it.each(...)(...)`
  it.each(RENDER_CASES)('compares $name', async (renderCase) => {
    // Arrange / Act
    const result = await runRenderComparison(renderCase)

    // Assert
    console.log(
      renderCase.name,
      result.totals
        .map(
          (total) =>
            `${String(total.frame)}: ${String(total.matchedCount)}/${String(total.originalCount)} (port ${String(total.portCount)})`
        )
        .join(' | '),
      '\n',
      result.groups
        .filter((group) => !['extra_in_port', 'state', 'color'].includes(group.kind))
        .slice(0, 30)
        .map(
          (group) =>
            `${group.kind} ${group.source} x${String(group.count)} in ${String(group.frames.length)} frames: ${group.firstDetail}`
        )
        .join('\n')
    )
    expect(result.totals.length).toBeGreaterThan(0)
  })
})
