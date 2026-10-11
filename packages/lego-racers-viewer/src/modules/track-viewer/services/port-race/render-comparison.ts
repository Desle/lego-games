import {
  compareRenderFrame,
  getOriginalTriangles,
  getCandidateMatrices,
  matchTextures,
  projectWorldTriangle,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import { getEffectViews, getRacerPoses } from '@lego-games/lego-racers/race-presentation'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { PortTexture } from '@lego-games/lego-racers/presentation-trace'
import type { Scene } from '@lego-games/lego-racers/scene'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import { readOriginalExecutable, readOriginalJam } from './original-game-files.ts'
import { ORIGINAL_STAGE_SIZE, runPortRace } from './port-race.ts'
import { getPortWorldTriangles } from './port-triangles.ts'
import type {
  AggregatedGroup,
  FrameTotals,
  RenderScenarioResult,
} from './render-comparison.types.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const getEffectScenes = (assets: RaceAssets): readonly Scene[] => {
  const { powerUpBricks, ...models } = assets.effectModels
  return [...Object.values(models), ...Object.values(powerUpBricks)].map((model) => model.scene)
}

const getSceneTextures = (assets: RaceAssets): ReadonlyMap<string, PortTexture> =>
  new Map(
    [assets.scene, ...getEffectScenes(assets)].flatMap((scene) =>
      scene.textures.flatMap((texture) =>
        texture.bitmap === null
          ? []
          : [
              [
                texture.name,
                {
                  width: texture.bitmap.width,
                  height: texture.bitmap.height,
                  colors: texture.bitmap.colors,
                },
              ] as const,
            ]
      )
    )
  )

const CANDIDATE_COUNT = 6
const TOLERANCES = Object.freeze({ positionPixels: 0.25, textureCoordinate: 0.001, colorLevels: 2 })

// Runs the original and the port through a scenario and compares the recorded frames: the mismatches of every frame,
// merged by kind and object.
export const runRenderComparison = async (
  request: TraceScenarioRequest
): Promise<RenderScenarioResult> => {
  const jam = readOriginalJam()
  const scenario = createPresentationScenario(jam, { ...request, isRenderRecorded: true })
  const original = await readOriginalPresentation(scenario)
  const assets = loadRaceAssets(
    jam,
    { executable: readOriginalExecutable(), tunes: new Map() },
    {
      raceFolder: scenario.raceFolder,
      racerCodes: scenario.racerCodes,
      racerCount: scenario.racerCount,
      localPlayerCount: scenario.localPlayerCount,
      isMirrored: scenario.isMirrored,
      fpuPrecision: FpuPrecision.SINGLE,
      isPlayerChampionCar: true,
    }
  )
  const stage = createRaceStage(assets, ORIGINAL_STAGE_SIZE)
  // Every texture the race has, used or not, so a surface the port draws with another texture still finds its own.
  const sceneTextures = getSceneTextures(assets)
  const allTextures = (used: ReadonlyMap<string, PortTexture>): ReadonlyMap<string, PortTexture> =>
    new Map([...sceneTextures, ...used])
  const groups = new Map<string, AggregatedGroup>()
  const totals: FrameTotals[] = []
  runPortRace(assets, scenario.frames, (portFrame) => {
    const { raceState, presentation, milliseconds, frame } = portFrame
    stage.update(getRacerPoses(raceState), presentation.cameraView, getEffectViews(raceState))
    stage.showHazards(raceState.trackLogic.worlds.track, [
      raceState.trackLogic.emitters.common,
      raceState.trackLogic.emitters.track,
    ])
    stage.animate(milliseconds)
    const originalFrame = original.renderFrames.find((candidate) => candidate.frame === frame)
    if (originalFrame === undefined) return
    const portTriangles = getPortWorldTriangles([stage.backgroundScene, stage.trackScene])
    const originalTriangles = getOriginalTriangles(originalFrame)
    const textureMatches = matchTextures(original.textures, allTextures(portTriangles.textures))
    const comparisons = getCandidateMatrices(originalFrame, CANDIDATE_COUNT).map((matrix) =>
      compareRenderFrame({
        original: originalTriangles,
        port: portTriangles.triangles.flatMap((triangle) => {
          const drawn = projectWorldTriangle(triangle, matrix)
          return drawn === null ? [] : [drawn]
        }),
        viewport: { width: ORIGINAL_STAGE_SIZE.width, height: ORIGINAL_STAGE_SIZE.height },
        textureMatches,
        tolerances: TOLERANCES,
      })
    )
    const comparison = comparisons.reduce((best, candidate) =>
      candidate.matchedCount > best.matchedCount ? candidate : best
    )
    totals.push({
      frame,
      originalCount: comparison.originalCount,
      portCount: comparison.portCount,
      matchedCount: comparison.matchedCount,
      farthestOriginalDepth: Math.max(
        ...originalTriangles.flatMap((triangle) =>
          triangle.vertices.map((vertex) => 1 / vertex.reciprocalW)
        )
      ),
    })
    for (const group of comparison.groups) {
      const key = `${group.kind}|${group.source}`
      const known = groups.get(key)
      groups.set(key, {
        kind: group.kind,
        source: group.source,
        frames: [...(known?.frames ?? []), frame],
        count: (known?.count ?? 0) + group.count,
        firstDetail: known?.firstDetail ?? group.firstDetail,
      })
    }
  })
  return Object.freeze({
    totals,
    groups: [...groups.values()].sort((left, right) => right.count - left.count),
  })
}
