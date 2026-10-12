import { getEffectViews, getRacerPoses } from '@lego-games/lego-racers/race-presentation'
import { DEVELOPMENT_GAME_FILE_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { getDevelopmentJam } from '../jam-file/jam-file.ts'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import { runRaceFrames } from '../race-frames/race-frames.ts'
import { createRaceViewport } from '../race-viewport/race-viewport.ts'
import { getScenarioRaceOptions } from '../scenario-race-options/scenario-race-options.ts'
import type {
  PixelTraceFrame,
  PixelTraceRequest,
  PixelTraceResult,
} from './pixel-trace-harness.types.ts'

const EXECUTABLE_NAME = 'LEGORacers.exe'
const BASE64_CHUNK_BYTES = 0x8000

const getBase64 = (bytes: Uint8ClampedArray): string => {
  const chunks: string[] = []
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK_BYTES)))
  }
  return btoa(chunks.join(''))
}

// Copies what the WebGL canvas shows into a 2D canvas in the same task as the render (the drawing buffer is cleared after).
const readCanvasPixels = (canvas: HTMLCanvasElement): Uint8ClampedArray => {
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d', { willReadFrequently: true })
  if (context === null) throw new Error('No 2D canvas to read the pixels with')
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

// Runs a scripted race in the viewer's own viewport (WebGL, the real materials and scene objects) and reads the pixels of
// the recorded frames. The page must be served by the development server, which hands out LEGO.JAM and the executable.
export const runPixelTrace = async (request: PixelTraceRequest): Promise<PixelTraceResult> => {
  const jam = await getDevelopmentJam()
  const executableResponse = await fetch(`${DEVELOPMENT_GAME_FILE_ROUTE}/${EXECUTABLE_NAME}`)
  const executable = new Uint8Array(await executableResponse.arrayBuffer())
  const assets = loadRaceAssets(
    jam,
    { executable, tunes: new Map() },
    getScenarioRaceOptions(request.race)
  )
  const size = { width: request.width, height: request.height }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const viewport = createRaceViewport(container, assets, size)
  const canvas = container.querySelector('canvas')
  if (canvas === null) throw new Error('The viewport made no canvas')
  const frames: PixelTraceFrame[] = []
  runRaceFrames(
    assets,
    size,
    request.frames,
    ({ frame, raceState, presentation, milliseconds }) => {
      viewport.update(
        getRacerPoses(raceState),
        presentation.cameraView,
        getEffectViews(raceState),
        presentation.warpView
      )
      viewport.showHazards(raceState.trackLogic.worlds.track, [
        raceState.racerSet.emitters.common,
        raceState.racerSet.emitters.track,
      ])
      viewport.animate(milliseconds)
      if (!request.recordFrames.includes(frame)) return
      viewport.render()
      frames.push({ frame, colorsBase64: getBase64(readCanvasPixels(canvas)) })
    },
    request.powerUpGrants
  )
  viewport.dispose()
  container.remove()
  return { frames }
}

// Hangs the runner on the window for the pixel trace's headless browser.
export const installPixelTraceHarness = () => Object.assign(window, { runPixelTrace })
