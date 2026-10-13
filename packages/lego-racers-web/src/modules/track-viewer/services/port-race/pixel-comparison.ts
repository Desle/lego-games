import { getFrameControls } from '@lego-games/lego-racers/golden-trace'
import { matchTextures, readOriginalPresentation } from '@lego-games/lego-racers/presentation-trace'
import type { PixelTolerance } from '@lego-games/lego-racers/presentation-trace'
import { getSceneTextures } from './render-comparison.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { compareRecordedFrame } from './compare-recorded-frame.ts'
import { ORIGINAL_STAGE_SIZE } from './port-race.ts'
import { readOriginalJam } from './original-game-files.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'
import type { PixelFrameResult, PixelTraceBrowser } from './pixel-comparison.types.ts'

// The port's background (race-viewport.ts); the original's sky covers it.
const CLEAR_COLOR = [0x10, 0x18, 0x20] as const

// Runs the original (emulator, rasterised from the Direct3D draws it made) and the viewer (headless Chrome, WebGL) through
// a scenario and compares the pixels of every recorded frame.
export const runPixelComparison = async (
  browser: PixelTraceBrowser,
  request: TraceScenarioRequest,
  tolerance: PixelTolerance,
  dumpDirectory: string | null = null
): Promise<readonly PixelFrameResult[]> => {
  const jam = readOriginalJam()
  const scenario = createPresentationScenario(jam, { ...request, isRenderRecorded: true })
  const recordFrames = request.recordFrames ?? []
  const { width, height } = ORIGINAL_STAGE_SIZE
  const original = await readOriginalPresentation(scenario)
  const assets = loadScenarioAssets(jam, scenario)
  const textureLabels = new Map(
    [...matchTextures(original.textures, getSceneTextures(assets))].map(
      ([hash, match]) => [hash, match.bestKey ?? hash] as const
    )
  )
  const pixelTrace = await browser.runPixelTrace({
    race: scenario,
    frames: scenario.frames.map((frame) => ({
      milliseconds: frame.milliseconds,
      controls: getFrameControls(frame),
    })),
    powerUpGrants: scenario.powerUpGrants ?? [],
    racerFinishes: scenario.racerFinishes ?? [],
    recordFrames,
    isHudIncluded: true,
    width,
    height,
  })
  return pixelTrace.frames.map(({ frame, colorsBase64 }) =>
    compareRecordedFrame({
      caseName: request.name,
      frame,
      original,
      portColorsBase64: colorsBase64,
      clearColor: CLEAR_COLOR,
      textureLabels,
      tolerance,
      dumpDirectory,
    })
  )
}
