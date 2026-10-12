import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getFrameControls } from '@lego-games/lego-racers/golden-trace'
import {
  comparePixels,
  matchTextures,
  rasteriseFrame,
  readOriginalPresentation,
} from '@lego-games/lego-racers/presentation-trace'
import type { PixelTolerance } from '@lego-games/lego-racers/presentation-trace'
import { getSceneTextures } from './render-comparison.ts'
import { loadScenarioAssets } from './scenario-assets.ts'
import { ORIGINAL_STAGE_SIZE } from './port-race.ts'
import { readOriginalJam } from './original-game-files.ts'
import { createPresentationScenario } from './trace-scenarios.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'
import type { PixelFrameResult, PixelTraceBrowser } from './pixel-comparison.types.ts'

const CHANNEL_COUNT = 4
// The port's background (race-viewport.ts); the original's sky covers it.
const CLEAR_COLOR = [0x10, 0x18, 0x20] as const
const MAXIMUM_REGION_COUNT = 6

const getBytes = (encoded: string): Uint8ClampedArray =>
  new Uint8ClampedArray(Buffer.from(encoded, 'base64'))

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
    recordFrames,
    width,
    height,
  })
  return pixelTrace.frames.map(({ frame, colorsBase64 }) => {
    const originalFrame = original.renderFrames.find((candidate) => candidate.frame === frame)
    if (originalFrame === undefined)
      throw new Error(`The original recorded no frame ${String(frame)}`)
    const port = getBytes(colorsBase64)
    if (port.length !== width * height * CHANNEL_COUNT) {
      throw new Error(`Frame ${String(frame)}: ${String(port.length)} bytes of port pixels`)
    }
    const reference = rasteriseFrame(originalFrame, original.textures, {
      width,
      height,
      isHudIncluded: false,
      clearColor: CLEAR_COLOR,
    })
    if (dumpDirectory !== null) {
      mkdirSync(dumpDirectory, { recursive: true })
      writeFileSync(
        resolve(dumpDirectory, `${request.name}-${String(frame)}-reference.rgba`),
        reference.colors
      )
      writeFileSync(resolve(dumpDirectory, `${request.name}-${String(frame)}-port.rgba`), port)
    }
    return {
      frame,
      comparison: comparePixels({
        reference,
        port: { width, height, colors: port },
        tolerance,
        textureLabels,
        maximumRegionCount: MAXIMUM_REGION_COUNT,
      }),
    }
  })
}
