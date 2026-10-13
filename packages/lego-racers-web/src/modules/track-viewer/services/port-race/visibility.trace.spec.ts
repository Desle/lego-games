import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { ORIGINAL_FAR_PLANE, ORIGINAL_NEAR_PLANE } from '../race-viewport/camera-frustum.ts'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import { ORIGINAL_STAGE_SIZE } from './port-race.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import { runRenderComparison } from './render-comparison.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

type VisibilityCase = {
  readonly request: TraceScenarioRequest
  // Port objects the original does not draw in these frames while the viewer once did: props past the far plane or
  // outside the frustum (GolDP.dll 0x10027d80's sphere test).
  readonly culledSources: readonly string[]
  // The original's driver cuts the track at the far plane in these frames: its farthest corner lies exactly on it.
  readonly isFarPlaneReached: boolean
}

const VISIBILITY_CASES: readonly VisibilityCase[] = [
  {
    request: {
      name: 'Titans, props and track at the far plane',
      raceFolder: 'RACEC1R1',
      localPlayerCount: 0,
      frameCount: 881,
      recordFrames: [430, 880],
    },
    culledSources: ['tithead/plainmat', 'tittot3/plainmat'],
    isFarPlaneReached: true,
  },
  {
    request: {
      name: 'Frankenstein, props out of the frustum',
      raceFolder: 'RACEC2R0',
      localPlayerCount: 0,
      frameCount: 701,
      recordFrames: [340, 700],
    },
    culledSources: ['drop/plainmat', 'kttowr/plainmat'],
    isFarPlaneReached: false,
  },
  {
    request: {
      name: 'Imperial Guard, props out of the frustum',
      raceFolder: 'RACEC0R1',
      localPlayerCount: 0,
      frameCount: 971,
      recordFrames: [790, 970],
    },
    culledSources: ['ship01/plainmat', 'cbase/nonemat'],
    isFarPlaneReached: true,
  },
  {
    request: {
      name: 'Titans mirrored, props and track at the far plane',
      raceFolder: 'RACEC1R1',
      isMirrored: true,
      localPlayerCount: 0,
      frameCount: 881,
      recordFrames: [430, 880],
    },
    culledSources: ['tithead/plainmat', 'tittot3/plainmat'],
    isFarPlaneReached: true,
  },
]

// The race camera sees depths 5 to 800 (GolDP.dll 0x1000c630 clips z against 0..w of the clip matrix); every instance
// is first tested by its level distance and its mesh sphere against the same six planes. The port draws exactly what
// remains: no object past them, and the original's farthest corner is the far plane itself.
describe.skipIf(!isGamePresent())(
  'what is drawn when: the near and far planes and instance culling',
  () => {
    it('draws with the original camera planes, 5 and 800', () => {
      // Arrange
      const jam = readOriginalJam()
      const scenario = createPresentationScenario(jam, {
        ...VISIBILITY_CASES[0]!.request,
        recordFrames: [],
      })

      // Act
      const stage = createRaceStage(loadScenarioAssets(jam, scenario), ORIGINAL_STAGE_SIZE)

      // Assert
      expect([stage.camera.near, stage.camera.far]).toEqual([
        ORIGINAL_NEAR_PLANE,
        ORIGINAL_FAR_PLANE,
      ])
    })

    it.each(VISIBILITY_CASES)(
      'draws nothing the original culls: $request.name',
      async (visibilityCase) => {
        // Arrange / Act
        const result = await runRenderComparison(visibilityCase.request)

        // Assert
        const extras = result.groups.filter(
          (group) =>
            group.kind === 'extra_in_port' && visibilityCase.culledSources.includes(group.source)
        )
        expect(
          extras.map((group) => `${group.source} ${String(group.count)} ${group.firstDetail}`)
        ).toEqual([])
        const farthest = Math.max(...result.totals.map((total) => total.farthestOriginalDepth))
        expect(farthest).toBeLessThanOrEqual(ORIGINAL_FAR_PLANE + 0.001)
        expect(farthest > ORIGINAL_FAR_PLANE - 0.01).toBe(visibilityCase.isFarPlaneReached)
      }
    )
  }
)
