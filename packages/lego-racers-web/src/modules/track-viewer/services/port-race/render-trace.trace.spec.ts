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
const POWER_UP_KIND_NAMES = ['cannon', 'shield', 'turbo', 'oil'] as const
const POWER_UP_LEVELS = [0, 1, 2, 3] as const
// Fired at frame 305: flight, hit, explosion and aftermath.
const POWER_UP_RECORD_FRAMES = [307, 312, 320, 326, 335, 355, 385]
const POWER_UP_CASES: readonly TraceScenarioRequest[] = POWER_UP_KIND_NAMES.flatMap(
  (kindName, kindIndex) =>
    POWER_UP_LEVELS.map((level): TraceScenarioRequest => ({
      name: `Royal Knights, power-up ${kindName} ${String(kindIndex + 1)}/${String(level)}`,
      raceFolder: 'RACEC0R0',
      recordFrames: POWER_UP_RECORD_FRAMES,
      powerUp: { kind: kindIndex + 1, level, grantFrame: 300, useFrame: 305, frameCount: 390 },
    }))
)
// The pictures a case must find in the port wherever the original draws them (a `missing_in_port` group named after one of
// them, or after its pixel hash while the port has no such texture, fails the case). The curse shows `curse1` on the track
// and round every cursed racer.
const CASE_DRAWN_PICTURES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'Royal Knights, curse hit': ['curse1', 'unmatched ee51a0cde6ae2c1d'],
})
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
    recordFrames: [310, 314, 316, 318, 320, 330, 345, 360, 375],
    powerUp: { kind: 3, level: 3, grantFrame: 300, useFrame: 305, frameCount: 380 },
  },
  {
    name: 'Royal Knights, power slide',
    raceFolder: 'RACEC0R0',
    isPowerSliding: true,
    recordFrames: [240, 260, 275, 285, 300, 340, 400],
  },
  { name: 'RACEC0R1', raceFolder: 'RACEC0R1', recordFrames: RECORD_FRAMES },
  {
    name: 'Royal Knights, oil slick',
    raceFolder: 'RACEC0R0',
    powerUp: { kind: 4, level: 0, grantFrame: 300, useFrame: 305, frameCount: 420 },
    recordFrames: [306, 312, 320, 340, 380, 415],
  },
  { name: 'RACEC0R2', raceFolder: 'RACEC0R2', recordFrames: RECORD_FRAMES },
  { name: 'RACEC0R3', raceFolder: 'RACEC0R3', recordFrames: RECORD_FRAMES },
  { name: 'RACEC1R0', raceFolder: 'RACEC1R0', recordFrames: RECORD_FRAMES },
  { name: 'RACEC3R0', raceFolder: 'RACEC3R0', recordFrames: RECORD_FRAMES },
  // The barrel (oil 4/1) explodes at frame 387 into the spiked explosion, and a computer racer's brick debris flies at
  // 491 to 521 (a warp case, nothing in these cases touches that racer).
  {
    name: 'Royal Knights, barrel explosion',
    raceFolder: 'RACEC0R0',
    recordFrames: [388, 392, 400, 410, 430],
    powerUp: { kind: 4, level: 1, grantFrame: 300, useFrame: 305, frameCount: 440 },
  },
  {
    name: 'Royal Knights, debris',
    raceFolder: 'RACEC0R0',
    recordFrames: [492, 496, 502, 510, 520],
    powerUp: { kind: 3, level: 3, grantFrame: 300, useFrame: 305, frameCount: 530 },
  },
  // The computers use a curse (4/3) at frame 164 and the player, accelerating from frame 175, drives into one at 191.
  // Frames 195 and 200 are left out: racer 4's curse figure there is drawn with fewer triangles by the original (power-up-visuals.md).
  {
    name: 'Royal Knights, curse hit',
    raceFolder: 'RACEC0R0',
    recordFrames: [186, 190, 192, 215, 230, 245, 260, 275, 290],
    powerUp: {
      kind: 4,
      level: 3,
      grantFrame: 162,
      useFrame: 1000,
      frameCount: 320,
      grantedRacers: [1, 2, 3, 4, 5],
    },
  },
  ...POWER_UP_CASES,
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
    const drawnPictures = CASE_DRAWN_PICTURES[renderCase.name] ?? []
    expect(
      result.groups
        .filter(
          (group) =>
            group.kind === 'missing_in_port' &&
            drawnPictures.some((picture) => group.source.startsWith(picture))
        )
        .map((group) => `${group.source} x${String(group.count)}`)
    ).toEqual([])
  })
})
