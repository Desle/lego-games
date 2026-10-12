import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type {
  FrontEndDrawCommand,
  FrontEndEnvironment,
  FrontEndState,
} from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import { DEVELOPMENT_GAME_FILE_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { getDevelopmentJam } from '../../services/jam-file/jam-file.ts'
import { createFrontEndRenderer } from '../front-end-renderer/front-end-renderer.ts'
import type {
  FrontEndPixelFrame,
  FrontEndPixelRequest,
  FrontEndPixelResult,
} from './front-end-pixel-harness.types.ts'
import { getPixelsBase64 } from '../../services/pixel-base64/pixel-base64.ts'

const EXECUTABLE_NAME = 'LEGORacers.exe'
// Progression hooks of the viewer's own controller: every circuit and every driver part is open.
const ALL_CIRCUITS_OPEN = 0x7f

const getNames = (
  commands: readonly FrontEndDrawCommand[],
  kind: 'image' | 'text'
): readonly string[] => [
  ...new Set(
    commands.flatMap((command) => {
      if (command.kind === 'image' && kind === 'image') return [command.imageName]
      return command.kind === 'text' && kind === 'text' ? [command.fontName] : []
    })
  ),
]

// Steps the real front end with scripted time and keys, draws every step with the viewer's own front-end renderer (the
// 2D canvas, the bitmap fonts and the 3D items of the menus) and reads the pixels of the recorded steps. The page must be
// served by the development server, which hands out LEGO.JAM and the executable.
export const runFrontEndPixelTrace = async (
  request: FrontEndPixelRequest
): Promise<FrontEndPixelResult> => {
  const archive = openJamArchive(await getDevelopmentJam())
  const executableResponse = await fetch(`${DEVELOPMENT_GAME_FILE_ROUTE}/${EXECUTABLE_NAME}`)
  const executable = new Uint8Array(await executableResponse.arrayBuffer())
  const resources = loadFrontEndResources(archive)
  const environment: FrontEndEnvironment = {
    // The emulated original has no gamepad, so its "vs" button is disabled.
    controllerCount: 0,
    unlockedCircuitMask: ALL_CIRCUITS_OPEN,
    randomTable: loadRandomTable(executable),
    isEveryPartUnlocked: true,
    playerRacerNames: [],
    standingRows: [],
  }
  const canvas = document.createElement('canvas')
  canvas.width = request.width
  canvas.height = request.height
  document.body.appendChild(canvas)
  const renderer = createFrontEndRenderer(canvas, resources, archive)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) throw new Error('No 2D canvas to read the pixels with')
  const lastStep = Math.max(...request.recordSteps)
  const frames: FrontEndPixelFrame[] = []
  let state: FrontEndState =
    request.firstScreenId === null
      ? createFrontEnd(resources, environment)
      : createFrontEnd(resources, environment, request.firstScreenId)
  for (let step = 0; step <= lastStep; step++) {
    if (step > 0) {
      state = stepFrontEnd(
        state,
        resources,
        environment,
        request.inputs[step - 1] ?? null,
        request.frameMilliseconds
      ).state
    }
    const { commands } = getFrontEndFrame(state, resources, environment)
    renderer.draw(commands, request.frameMilliseconds)
    if (request.recordSteps.includes(step)) {
      frames.push({
        step,
        colorsBase64: getPixelsBase64(
          context.getImageData(0, 0, request.width, request.height).data
        ),
        imageNames: getNames(commands, 'image'),
        fontNames: getNames(commands, 'text'),
      })
    }
  }
  renderer.dispose()
  canvas.remove()
  return { frames }
}

// Hangs the runner on the window for the pixel trace's headless browser.
export const installFrontEndPixelHarness = () => Object.assign(window, { runFrontEndPixelTrace })
