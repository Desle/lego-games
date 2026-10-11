import {
  compareRenderFrame,
  getIsOriginalPresentationAvailable,
  getOriginalTriangles,
  getWorldToScreenMatrix,
  matchTextures,
  projectWorldTriangle,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import { getEffectViews, getRacerPoses } from '@lego-games/lego-racers/race-presentation'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import { createRaceStage } from '../race-viewport/race-viewport.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'
import { ORIGINAL_STAGE_SIZE, runPortRace } from './port-race.ts'
import { getPortWorldTriangles } from './port-triangles.ts'
import { createPresentationScenario } from './trace-scenarios.ts'

const isGamePresent = () => getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()

describe.skipIf(!isGamePresent())('render trace', () => {
  // eslint-disable-next-line no-restricted-syntax -- the lint rule knows `describe(...)`, not `describe.skipIf(...)(...)`
  it('compares Royal Knights', async () => {
    // Arrange
    const jam = readOriginalJam()
    const recordFrames = [5, 60, 150, 170, 200, 300]
    const scenario = createPresentationScenario(jam, {
      name: 'Royal Knights',
      raceFolder: 'RACEC0R0',
      recordFrames,
      isRenderRecorded: true,
    })
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
    const report: string[] = []

    // Act
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
      const matrix = getWorldToScreenMatrix(originalFrame)
      const counts = new Map<string, number>()
      for (const draw of originalFrame.draws) {
        const key = draw.modelMatrix.map((value) => value.toFixed(2)).join(' ')
        counts.set(key, (counts.get(key) ?? 0) + (draw.indices?.length ?? draw.vertices.length) / 3)
      }
      report.push(`matrices ${JSON.stringify([...counts].sort((a, b) => b[1] - a[1]).slice(0, 4))}`)
      if (matrix === null) return
      const portTriangles = getPortWorldTriangles([stage.backgroundScene, stage.trackScene])
      const projected = portTriangles.triangles.flatMap((triangle) => {
        const drawn = projectWorldTriangle(triangle, matrix)
        return drawn === null ? [] : [drawn]
      })
      const comparison = compareRenderFrame({
        original: getOriginalTriangles(originalFrame),
        port: projected,
        viewport: { width: 640, height: 480 },
        textureMatches: matchTextures(original.textures, portTriangles.textures),
        tolerances: { positionPixels: 0.25, textureCoordinate: 0.001, colorLevels: 2 },
      })
      report.push(
        `frame ${String(frame)}: original ${String(comparison.originalCount)} port ${String(comparison.portCount)} matched ${String(comparison.matchedCount)} clipped ${String(comparison.clippedCount)}`
      )
      for (const group of comparison.groups.slice(0, 40)) {
        report.push(`  ${group.kind} ${group.source} x${String(group.count)}: ${group.firstDetail}`)
      }
    })

    // Assert
    console.log(report.join('\n'))
    expect(report.length).toBeGreaterThan(0)
  })
})
