import {
  compareQuadPlacements,
  compareRenderFrameByRoot,
  getBoundingRectangle,
  getOriginalQuads,
  getOriginalTriangles,
  getCandidateMatrices,
  matchTextures,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import { getEffectViews, getRacerPoses } from '@lego-games/lego-racers/race-presentation'
import { layoutText } from '@lego-games/lego-racers/font-rendering'
import {
  createFloatArithmetic,
  FpuPrecision,
  RACE_FPU_PRECISION,
} from '@lego-games/lego-racers/simulation-math'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { PortTexture, QuadPlacement } from '@lego-games/lego-racers/presentation-trace'
import type { Scene } from '@lego-games/lego-racers/scene'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import { readOriginalExecutable, readOriginalJam } from './original-game-files.ts'
import { ORIGINAL_STAGE_SIZE, runPortRace } from './port-race.ts'
import { getPortWorldTriangles } from './port-triangles.ts'
import type {
  AggregatedGroup,
  FrameTotals,
  HudFrameResult,
  RenderScenarioResult,
} from './render-comparison.types.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

const getEffectScenes = (assets: RaceAssets): readonly Scene[] => {
  const { powerUpBricks, rocket, barrel, magnet, spikedExplosion, enhancementBrick, warpTunnel } =
    assets.effectModels
  return [
    ...[
      rocket,
      barrel,
      magnet,
      spikedExplosion,
      enhancementBrick,
      ...Object.values(powerUpBricks),
    ].map((model) => model.scene),
    warpTunnel,
  ]
}

export const getSceneTextures = (assets: RaceAssets): ReadonlyMap<string, PortTexture> =>
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
const HUD_TOLERANCE_PIXELS = 0.25
// The HUD never wraps its text (the overlay's width, race-hud-overlay.tsx).
const HUD_UNBOUNDED_WIDTH = 0x7fff
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
  const hudTextures = new Map(
    [
      ...assets.hudImages,
      ...[...assets.hudFonts].map(([name, hudFont]) => [name, hudFont.image] as const),
    ].map(
      ([name, image]) =>
        [name, { width: image.width, height: image.height, colors: image.colors }] as const
    )
  )
  const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
  const hudResults: HudFrameResult[] = []
  const groups = new Map<string, AggregatedGroup>()
  const totals: FrameTotals[] = []
  runPortRace(
    assets,
    scenario.frames,
    (portFrame) => {
      const { raceState, presentation, milliseconds, frame } = portFrame
      stage.update(
        getRacerPoses(raceState),
        presentation.cameraView,
        getEffectViews(raceState),
        presentation.warpView
      )
      stage.showHazards(raceState.trackLogic.worlds.track, [
        raceState.racerSet.emitters.common,
        raceState.racerSet.emitters.track,
      ])
      stage.animate(milliseconds)
      const originalFrame = original.renderFrames.find((candidate) => candidate.frame === frame)
      if (originalFrame === undefined) return
      const portTriangles = getPortWorldTriangles([
        ...(stage.backgroundScene.visible ? stage.backgroundScene.children : []),
        ...stage.trackScene.children,
      ])
      const originalTriangles = getOriginalTriangles(originalFrame)
      const textureMatches = matchTextures(original.textures, allTextures(portTriangles.textures))
      const comparison = compareRenderFrameByRoot({
        original: originalTriangles,
        port: portTriangles.triangles,
        candidates: getCandidateMatrices(originalFrame, CANDIDATE_COUNT, ORIGINAL_STAGE_SIZE),
        viewport: { width: ORIGINAL_STAGE_SIZE.width, height: ORIGINAL_STAGE_SIZE.height },
        textureMatches,
        tolerances: TOLERANCES,
      })
      if (presentation.hudFrame !== null) {
        const hud = compareQuadPlacements({
          original: getOriginalQuads(originalFrame, true),
          port: presentation.hudFrame.commands.flatMap((command): readonly QuadPlacement[] => {
            if (command.kind === 'fill') {
              return [
                {
                  left: command.x,
                  top: command.y,
                  right: command.x + command.width,
                  bottom: command.y + command.height,
                  textureKey: null,
                  source: 'fill',
                },
              ]
            }
            if (command.kind === 'text') {
              const hudFont = assets.hudFonts.get(command.font)
              if (hudFont === undefined) return []
              return layoutText({
                font: hudFont.font,
                text: Array.from(command.text, (letter) => letter.charCodeAt(0)),
                surface: ORIGINAL_STAGE_SIZE,
                x: command.x,
                y: command.y,
                maximumWidth: HUD_UNBOUNDED_WIDTH,
                lineGap: 0,
                scale: { x: command.scaleX, y: command.scaleY },
                clip: null,
                alignment: 'left',
                arithmetic,
              }).map((glyph) => ({
                ...glyph.destination,
                textureKey: command.font,
                source: command.font,
              }))
            }
            if (command.kind === 'image_part') {
              return [
                {
                  left: command.x,
                  top: command.y,
                  right: command.x + command.width,
                  bottom: command.y + command.height,
                  textureKey: command.imageName.toUpperCase(),
                  source: command.imageName.toUpperCase(),
                },
              ]
            }
            if (command.kind === 'polygon') {
              return [
                {
                  ...getBoundingRectangle(command.vertices),
                  textureKey: command.imageName,
                  source: command.imageName ?? 'fill',
                },
              ]
            }
            return [
              {
                left: command.x,
                top: command.y,
                right: command.x + command.width,
                bottom: command.y + command.height,
                textureKey: command.imageName,
                source: command.imageName,
              },
            ]
          }),
          textureMatches: matchTextures(original.textures, hudTextures),
          tolerancePixels: HUD_TOLERANCE_PIXELS,
        })
        hudResults.push({ frame, ...hud })
      }
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
    },
    scenario.powerUpGrants ?? []
  )
  return Object.freeze({
    hudResults,
    totals,
    groups: [...groups.values()].sort((left, right) => right.count - left.count),
  })
}
