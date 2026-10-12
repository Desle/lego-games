import { getEffectViews, getRacerPoses } from '@lego-games/lego-racers/race-presentation'
import { DEVELOPMENT_GAME_FILE_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { getDevelopmentJam } from '../jam-file/jam-file.ts'
import { createBitmapFontPainter } from '../bitmap-font-painter/bitmap-font-painter.ts'
import { paintHud } from '../hud-painter/hud-painter.ts'
import { createHudImageUrls } from '../hud-resources/hud-resources.ts'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import { runRaceFrames } from '../race-frames/race-frames.ts'
import { createRaceViewport } from '../race-viewport/race-viewport.ts'
import { getScenarioRaceOptions } from '../scenario-race-options/scenario-race-options.ts'
import type {
  PixelTraceFrame,
  PixelTraceRequest,
  PixelTraceResult,
} from './pixel-trace-harness.types.ts'
import { getPixelsBase64 } from '../pixel-base64/pixel-base64.ts'

const EXECUTABLE_NAME = 'LEGORacers.exe'

// Copies what the WebGL canvas shows into a 2D canvas in the same task as the render (the drawing buffer is cleared after),
// then lays the HUD's canvas over it as the page does.
const readCanvasPixels = (
  canvas: HTMLCanvasElement,
  paintOverlay: (context: CanvasRenderingContext2D) => void
): Uint8ClampedArray => {
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d', { willReadFrequently: true })
  if (context === null) throw new Error('No 2D canvas to read the pixels with')
  context.drawImage(canvas, 0, 0)
  const overlay = document.createElement('canvas')
  overlay.width = canvas.width
  overlay.height = canvas.height
  const overlayContext = overlay.getContext('2d')
  if (overlayContext === null) throw new Error('No 2D canvas to paint the HUD with')
  paintOverlay(overlayContext)
  context.drawImage(overlay, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

// The HUD's pictures as decoded images, the form the HUD painter draws parts and triangles of.
const loadHudImages = async (urls: ReadonlyMap<string, string>) => {
  const images = new Map(
    [...urls].map(([name, url]) => {
      const image = new Image()
      image.src = url
      return [name, image] as const
    })
  )
  await Promise.all([...images.values()].map((image) => image.decode()))
  return images
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
  const hudImages = await loadHudImages(createHudImageUrls(assets.hudImages))
  const hudPainter = createBitmapFontPainter()
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
        presentation.warpView,
        [],
        presentation.screenFades,
        presentation.fieldOfViewDegrees
      )
      viewport.showHazards(raceState.trackLogic.worlds.track, [
        raceState.racerSet.emitters.common,
        raceState.racerSet.emitters.track,
      ])
      viewport.animate(milliseconds)
      if (!request.recordFrames.includes(frame)) return
      viewport.render()
      const hudCommands = request.isHudIncluded ? (presentation.hudFrame?.commands ?? []) : []
      frames.push({
        frame,
        colorsBase64: getPixelsBase64(
          readCanvasPixels(canvas, (context) =>
            paintHud(context, {
              commands: hudCommands,
              fonts: assets.hudFonts,
              loadedImages: hudImages,
              painter: hudPainter,
              width: size.width,
              height: size.height,
              isImagePainted: true,
            })
          )
        ),
      })
    },
    request.powerUpGrants
  )
  viewport.dispose()
  container.remove()
  return { frames }
}

// Hangs the runner on the window for the pixel trace's headless browser.
export const installPixelTraceHarness = () => Object.assign(window, { runPixelTrace })
