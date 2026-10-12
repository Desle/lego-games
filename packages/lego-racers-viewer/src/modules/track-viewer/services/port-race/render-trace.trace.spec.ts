import { writeFileSync } from 'node:fs'
import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { getIsOriginalGamePresent } from './original-game-files.ts'
import { runRenderComparison } from './render-comparison.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

// Of the triangles the original drew, this share has a partner in the port on every recorded frame. What is left over is
// listed in render-trace.md (draw distance of the track, lit models' colours, animation clocks); a mirrored track drawn
// the wrong way round halves it.
const MINIMUM_MATCHED_SHARE = 0.85
const RECORD_FRAMES = [5, 100, 170, 250, 320]
const RENDER_CASES: readonly TraceScenarioRequest[] = [
  { name: 'Royal Knights', raceFolder: 'RACEC0R0', recordFrames: RECORD_FRAMES },
  {
    name: 'Royal Knights, mirrored',
    raceFolder: 'RACEC0R0',
    isMirrored: true,
    recordFrames: RECORD_FRAMES,
  },
  {
    name: 'Royal Knights, warp',
    raceFolder: 'RACEC0R0',
    recordFrames: [310, 320, 330, 345, 360, 375],
    warp: { grantFrame: 300, useFrame: 305, frameCount: 380 },
  },
  {
    name: 'Royal Knights, power slide',
    raceFolder: 'RACEC0R0',
    isPowerSliding: true,
    recordFrames: [240, 260, 275, 285, 300, 340, 400],
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
    const framesOverride = process.env['RENDER_TRACE_FRAMES']
    const recordFrames =
      framesOverride === undefined ? renderCase.recordFrames : framesOverride.split(',').map(Number)
    const result = await runRenderComparison(
      recordFrames === undefined ? renderCase : { ...renderCase, recordFrames }
    )

    // Assert
    console.log(
      renderCase.name,
      result.groups
        .filter((group) => group.kind === 'color')
        .slice(0, 12)
        .map(
          (group) =>
            `color ${group.source} x${String(group.count)} in ${String(group.frames.length)} frames: ${group.firstDetail}`
        )
        .join('\n'),
      result.hudResults
        .map(
          (hud) =>
            `HUD ${String(hud.frame)}: original ${String(hud.originalCount)} port ${String(hud.portCount)} matched ${String(hud.matchedCount)} ` +
            hud.groups
              .slice(0, 8)
              .map(
                (group) =>
                  `${group.kind} ${group.source} x${String(group.count)} ${group.firstDetail}`
              )
              .join('; ')
        )
        .join('\n')
    )
    const groupsPath = process.env['RENDER_TRACE_GROUPS']
    if (groupsPath !== undefined) {
      writeFileSync(
        groupsPath,
        `${JSON.stringify(result.totals)}\n${result.groups
          .slice(0, 40)
          .map(
            (group) =>
              `${group.kind} ${group.source} x${String(group.count)} frames ${group.frames.join(',')}: ${group.firstDetail}`
          )
          .join('\n')}`
      )
    }
    const lowest = Math.min(
      ...result.totals.map((total) => total.matchedCount / total.originalCount)
    )
    expect(result.totals.length).toBe(recordFrames?.length)
    expect(lowest).toBeGreaterThan(MINIMUM_MATCHED_SHARE)
  })
})
