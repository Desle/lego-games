import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { comparePixels, rasteriseFrame } from '@lego-games/lego-racers/presentation-trace'
import { ORIGINAL_STAGE_SIZE } from './port-race.ts'
import type { RecordedFrameInput } from './compare-recorded-frame.types.ts'
import type { PixelFrameResult } from './pixel-comparison.types.ts'

const CHANNEL_COUNT = 4
const MAXIMUM_REGION_COUNT = 8

// Rasterises the original's draws of a frame, compares them with the viewer's pixels and, with a dump folder, writes both
// images (`<case>-<frame>-reference.rgba` and `-port.rgba`, 640 x 480 x 4 bytes) for analysis with numbers.
export const compareRecordedFrame = (input: RecordedFrameInput): PixelFrameResult => {
  const { width, height } = ORIGINAL_STAGE_SIZE
  const { frame } = input
  const originalFrame = input.original.renderFrames.find((candidate) => candidate.frame === frame)
  if (originalFrame === undefined)
    throw new Error(`The original recorded no frame ${String(frame)}`)
  const port = new Uint8ClampedArray(Buffer.from(input.portColorsBase64, 'base64'))
  if (port.length !== width * height * CHANNEL_COUNT) {
    throw new Error(`Frame ${String(frame)}: ${String(port.length)} bytes of port pixels`)
  }
  const reference = rasteriseFrame(originalFrame, input.original.textures, {
    width,
    height,
    isHudIncluded: true,
    clearColor: input.clearColor,
  })
  if (input.dumpDirectory !== null) {
    mkdirSync(input.dumpDirectory, { recursive: true })
    writeFileSync(
      resolve(input.dumpDirectory, `${input.caseName}-${String(frame)}-reference.rgba`),
      reference.colors
    )
    writeFileSync(
      resolve(input.dumpDirectory, `${input.caseName}-${String(frame)}-port.rgba`),
      port
    )
  }
  return {
    frame,
    comparison: comparePixels({
      reference,
      port: { width, height, colors: port },
      tolerance: input.tolerance,
      textureLabels: input.textureLabels,
      maximumRegionCount: MAXIMUM_REGION_COUNT,
    }),
  }
}
