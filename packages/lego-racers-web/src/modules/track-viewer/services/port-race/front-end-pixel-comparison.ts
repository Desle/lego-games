import { loadFrontEndResources } from '@lego-games/lego-racers/front-end'
import type { FrontEndInput } from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { matchTextures, readOriginalFrontEnd } from '@lego-games/lego-racers/presentation-trace'
import type { PixelTolerance, PortTexture } from '@lego-games/lego-racers/presentation-trace'
import { compareRecordedFrame } from './compare-recorded-frame.ts'
import { readOriginalJam } from './original-game-files.ts'
import { ORIGINAL_STAGE_SIZE } from './port-race.ts'
import type { FrontEndPixelCase } from './front-end-pixel-cases.types.ts'
import type { PixelFrameResult, PixelTraceBrowser } from './pixel-comparison.types.ts'

const FRAME_MILLISECONDS = 33
const MENU_OPENED_FRAME = 154
const PUSH_FRAME = 200
const BLACK = [0, 0, 0] as const

// Runs the original front end (emulator, rasterised from the Direct3D draws it made) and the viewer's real front-end
// renderer (headless Chrome, the 2D canvas and the 3D items) through the same keys and compares the pixels of every
// recorded frame. A key tapped in original frame f shows in frame f + 1.
export const runFrontEndPixelComparison = async (
  browser: PixelTraceBrowser,
  pixelCase: FrontEndPixelCase,
  tolerance: PixelTolerance,
  dumpDirectory: string | null = null
): Promise<readonly PixelFrameResult[]> => {
  const startFrame = pixelCase.pushedScreenId === null ? MENU_OPENED_FRAME : PUSH_FRAME
  const lastFrame = Math.max(...pixelCase.recordFrames)
  const original = await readOriginalFrontEnd({
    name: pixelCase.name,
    frames: Array.from({ length: lastFrame + 1 }, (_, frame) => {
      const key = pixelCase.keys.find((candidate) => candidate.frame === frame)
      return {
        milliseconds: FRAME_MILLISECONDS,
        scanCodes: key === undefined ? [] : [key.scanCode],
      }
    }),
    recordFrames: pixelCase.recordFrames,
    isRenderRecorded: true,
    pushScreens:
      pixelCase.pushedScreenId === null
        ? []
        : [{ frame: PUSH_FRAME, screenId: pixelCase.pushedScreenId }],
  })
  const inputs: readonly (FrontEndInput | null)[] = Array.from(
    { length: lastFrame - startFrame },
    (_, step) =>
      pixelCase.keys.find((candidate) => candidate.frame === startFrame + step)?.input ?? null
  )
  const { width, height } = ORIGINAL_STAGE_SIZE
  const portTrace = await browser.runFrontEndPixelTrace({
    firstScreenId: pixelCase.pushedScreenId,
    inputs,
    frameMilliseconds: FRAME_MILLISECONDS,
    recordSteps: pixelCase.recordFrames.map((frame) => frame - startFrame),
    width,
    height,
  })
  const resources = loadFrontEndResources(openJamArchive(readOriginalJam()))
  const portTextures = new Map<string, PortTexture>(
    portTrace.frames
      .flatMap((frame) => [...frame.imageNames, ...frame.fontNames])
      .flatMap((name) => {
        const image = resources.getImage(name) ?? resources.getFontImage(name)
        return image === null
          ? []
          : [[name, { width: image.width, height: image.height, colors: image.colors }] as const]
      })
  )
  const textureLabels = new Map(
    [...matchTextures(original.textures, portTextures)].map(
      ([hash, match]) => [hash, match.bestKey ?? hash] as const
    )
  )
  return portTrace.frames.map(({ step, colorsBase64 }) =>
    compareRecordedFrame({
      caseName: pixelCase.name,
      frame: step + startFrame,
      original,
      portColorsBase64: colorsBase64,
      clearColor: BLACK,
      textureLabels,
      tolerance,
      dumpDirectory,
    })
  )
}
