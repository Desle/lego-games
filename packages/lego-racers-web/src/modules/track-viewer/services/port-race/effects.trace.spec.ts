import { getIsOriginalPresentationAvailable } from '@lego-games/lego-racers/presentation-trace'
import { readOriginalPresentation } from '@lego-games/lego-racers/presentation-trace'
import type { DrawnTriangle } from '@lego-games/lego-racers/presentation-trace'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'
import { ORIGINAL_STAGE_SIZE, runPortRace } from './port-race.ts'
import { getCoverageRaces } from './render-coverage.ts'
import { compareWorldFrame, getSceneTextures } from './render-comparison.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { EffectFrameResult, EffectTraceCase } from './effect-cases.types.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()
const CANDIDATE_COUNT = 80
const VIEWPORT_EDGE_PIXELS = 1

const EFFECT_CASES: readonly EffectTraceCase[] = Object.freeze([
  // Snow: the emitter sits 100 in front of the camera, spread across the view, and goes while a track event's colour
  // shift is on the racer (0x0048eb70; frames 520 and 610 are inside one).
  {
    name: 'Ice Planet, snow',
    race: 'ipp',
    frames: [170, 250, 340, 520, 610],
    texture: /snowflak/,
  },
  // Turbo flames and burn figures: their texture scroll has run since the effect started (0x0045ce20).
  {
    name: 'Ice Planet, turbo flames',
    race: 'ipp',
    frames: [230, 250, 260],
    texture: /tflame2|smturbo3/,
  },
])

const getIsOnViewportEdge = (triangle: DrawnTriangle): boolean =>
  triangle.vertices.some(
    (vertex) =>
      vertex.y >= ORIGINAL_STAGE_SIZE.height - VIEWPORT_EDGE_PIXELS ||
      vertex.y <= VIEWPORT_EDGE_PIXELS ||
      vertex.x >= ORIGINAL_STAGE_SIZE.width - VIEWPORT_EDGE_PIXELS ||
      vertex.x <= VIEWPORT_EDGE_PIXELS
  )

const runEffectCase = async (
  effectCase: EffectTraceCase
): Promise<readonly EffectFrameResult[]> => {
  const jam = readOriginalJam()
  const race = getCoverageRaces(jam).find((candidate) => candidate.catalogName === effectCase.race)
  if (race === undefined) throw new Error(`No race ${effectCase.race}`)
  const scenario = createPresentationScenario(jam, {
    name: effectCase.name,
    raceFolder: race.raceFolder,
    racerCodes: race.racerCodes,
    circuitName: race.circuitName,
    isMirrored: race.isMirrored,
    localPlayerCount: 0,
    frameCount: Math.max(...effectCase.frames) + 1,
    recordFrames: effectCase.frames,
    isRenderRecorded: true,
  })
  const original = await readOriginalPresentation(scenario)
  const assets = loadScenarioAssets(jam, scenario)
  const stage = createRaceStage(assets, ORIGINAL_STAGE_SIZE)
  const sceneTextures = getSceneTextures(assets)
  const results: EffectFrameResult[] = []
  runPortRace(assets, scenario.frames, (portFrame) => {
    const world = compareWorldFrame({
      stage,
      portFrame,
      original,
      sceneTextures,
      candidateCount: CANDIDATE_COUNT,
    })
    if (world === null) return
    const matched = new Set(world.comparison.matchedOriginals)
    const effectTriangles = world.originalTriangles.filter((triangle) =>
      effectCase.texture.test(world.textureMatches.get(triangle.textureKey ?? '')?.bestKey ?? '')
    )
    const unmatched = effectTriangles.filter(
      (triangle) => !matched.has(triangle) && !getIsOnViewportEdge(triangle)
    )
    results.push({
      frame: portFrame.frame,
      originalCount: effectTriangles.length,
      unmatchedCount: unmatched.length,
      extraCount: world.comparison.groups
        .filter(
          (group) =>
            group.kind === 'extra_in_port' &&
            effectCase.texture.test(group.firstPort?.textureKey ?? '')
        )
        .reduce((total, group) => total + group.count, 0),
      coordinateMismatchCount: world.comparison.groups
        .filter(
          (group) =>
            group.kind === 'texture_coordinates' &&
            effectCase.texture.test(group.firstPort?.textureKey ?? '')
        )
        .reduce((total, group) => total + group.count, 0),
    })
  })
  return results
}

describe.skipIf(!isGamePresent())('effects against the original', () =>
  it.each(EFFECT_CASES)(
    'draws $name as the original does',
    async (effectCase) => {
      // Arrange
      // Act
      const results = await runEffectCase(effectCase)

      // Assert
      expect(results.map((result) => result.frame)).toEqual(effectCase.frames)
      expect(results.map((result) => result.unmatchedCount)).toEqual(results.map(() => 0))
      expect(results.map((result) => result.extraCount)).toEqual(results.map(() => 0))
      expect(results.map((result) => result.coordinateMismatchCount)).toEqual(results.map(() => 0))
      expect(results.some((result) => result.originalCount > 0)).toBe(true)
    },
    600_000
  )
)
