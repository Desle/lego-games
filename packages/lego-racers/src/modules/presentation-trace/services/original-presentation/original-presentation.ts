import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import {
  EMULATOR_DIRECTORY,
  EMULATOR_PYTHON_PATH,
  GAME_FILES_DIRECTORY,
} from '../../../../shared/emulator/emulator-client.ts'
import type {
  OriginalAudioEvent,
  OriginalAudioFrame,
  OriginalDraw,
  OriginalPresentation,
  OriginalRenderFrame,
  OriginalRenderState,
  OriginalTexture,
  OriginalVertex,
  OriginalViewport,
  FrontEndScenario,
  PresentationScenario,
} from '../../types/presentation-trace.types.ts'
import type {
  AudioFrameLine,
  DrawLine,
  PresentationTraceLine,
  RenderFrameLine,
  TextureLine,
  ViewportLine,
} from './original-presentation.types.ts'

const TRACE_SCRIPT_PATH = resolve(EMULATOR_DIRECTORY, 'presentation_trace.py')
const FRONT_END_SCRIPT_PATH = resolve(EMULATOR_DIRECTORY, 'front_end_trace.py')
const VERTEX_BYTES = 32
const VERTEX_FLOAT_OFFSETS = [0, 4, 8, 12, 24, 28] as const

export const getIsOriginalPresentationAvailable = (): boolean =>
  existsSync(EMULATOR_PYTHON_PATH) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'LEGORacers.exe')) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'GolDP.dll')) &&
  existsSync(resolve(GAME_FILES_DIRECTORY, 'LEGO.JAM'))

const getScenarioForEmulator = (scenario: PresentationScenario) => ({
  raceFolder: scenario.raceFolder,
  racerCodes: scenario.racerCodes,
  racerCount: scenario.racerCount,
  localPlayerCount: scenario.localPlayerCount,
  circuit: scenario.circuitName,
  isMirrored: scenario.isMirrored,
  recordFrames: scenario.recordFrames,
  isRenderRecorded: scenario.isRenderRecorded,
  frames: scenario.frames.map((frame) => ({ dt: frame.milliseconds, keys: frame.scanCodes })),
})

const getBytes = (encoded: string): Uint8Array => new Uint8Array(Buffer.from(encoded, 'base64'))

const getVertices = (encoded: string, count: number): readonly OriginalVertex[] => {
  const bytes = getBytes(encoded)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return Array.from({ length: count }, (_, index) => {
    const base = index * VERTEX_BYTES
    const [x, y, depth, reciprocalW, u, v] = VERTEX_FLOAT_OFFSETS.map((offset) =>
      view.getFloat32(base + offset, true)
    )
    return Object.freeze({
      x: x ?? 0,
      y: y ?? 0,
      depth: depth ?? 0,
      reciprocalW: reciprocalW ?? 0,
      diffuse: view.getUint32(base + 16, true),
      specular: view.getUint32(base + 20, true),
      u: u ?? 0,
      v: v ?? 0,
    })
  })
}

const getIndices = (encoded: string): readonly number[] => {
  const bytes = getBytes(encoded)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return Array.from({ length: bytes.byteLength / 2 }, (_, index) => view.getUint16(index * 2, true))
}

const getDraw = (line: DrawLine): OriginalDraw =>
  Object.freeze({
    primitive: line.primitive,
    fvf: line.fvf,
    stateIndex: line.state,
    textureHash: line.texture,
    vertices: getVertices(line.vertices, line.vertexCount),
    indices: line.indices === undefined ? null : getIndices(line.indices),
    clipMatrix: line.clip ?? [],
    modelMatrix: line.model ?? [],
  })

const getTexture = (line: TextureLine): OriginalTexture =>
  Object.freeze({
    hash: line.hash,
    width: line.width,
    height: line.height,
    pitch: line.pitch,
    bitsPerPixel: line.bitsPerPixel,
    masks: line.masks,
    pixels: getBytes(line.pixels),
  })

const getViewport = (line: ViewportLine): OriginalViewport =>
  Object.freeze({ x: line.x, y: line.y, width: line.width, height: line.height })

const getRenderFrame = (line: RenderFrameLine): OriginalRenderFrame => {
  const viewportLine = line.events.find((event): event is ViewportLine => event.kind === 'viewport')
  const states: readonly OriginalRenderState[] = line.states
  return Object.freeze({
    frame: line.frame,
    viewport: viewportLine === undefined ? null : getViewport(viewportLine),
    states,
    draws: line.events.filter((event): event is DrawLine => event.kind === 'draw').map(getDraw),
  })
}

const getAudioFrame = (line: AudioFrameLine): OriginalAudioFrame =>
  Object.freeze({
    frame: line.frame,
    events: line.events.map(({ kind, ...values }): OriginalAudioEvent =>
      Object.freeze({ kind, values })
    ),
  })

// Runs the original race in the emulator (reverse-engineering/emulator/presentation_trace.py) and collects what it
// draws and plays: the textures it uploaded, the Direct3D draws of the recorded frames and the DirectSound calls.
export const readOriginalPresentation = (
  scenario: PresentationScenario
): Promise<OriginalPresentation> =>
  readTraceScript(TRACE_SCRIPT_PATH, getScenarioForEmulator(scenario))

// The same for the front end (reverse-engineering/emulator/front_end_trace.py): the scenario's keys are taps.
export const readOriginalFrontEnd = (scenario: FrontEndScenario): Promise<OriginalPresentation> =>
  readTraceScript(FRONT_END_SCRIPT_PATH, {
    recordFrames: scenario.recordFrames,
    isRenderRecorded: scenario.isRenderRecorded,
    frames: scenario.frames.map((frame) => ({ dt: frame.milliseconds, keys: frame.scanCodes })),
  })

const readTraceScript = async (
  scriptPath: string,
  scenario: object
): Promise<OriginalPresentation> => {
  const child = spawn(EMULATOR_PYTHON_PATH, ['-I', scriptPath], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  child.stdin.end(JSON.stringify(scenario))
  const textures = new Map<string, OriginalTexture>()
  const renderFrames: OriginalRenderFrame[] = []
  const audioFrames: OriginalAudioFrame[] = []
  const progress = {
    isDone: false,
  }
  const lines = createInterface({ input: child.stdout })
  lines.on('line', (text) => {
    const line = JSON.parse(text) as PresentationTraceLine
    if (line.type === 'texture') {
      const texture = getTexture(line)
      textures.set(texture.hash, texture)
    } else if (line.type === 'render_frame') {
      renderFrames.push(getRenderFrame(line))
    } else if (line.type === 'audio_frame') {
      audioFrames.push(getAudioFrame(line))
    } else {
      progress.isDone = true
    }
  })
  // 'close' comes after the output is read to its end.
  const exitCode = await new Promise<number | null>((resolveClose) =>
    child.once('close', resolveClose)
  )
  if (!progress.isDone || exitCode !== 0) {
    throw new Error(`The original presentation trace failed (exit ${String(exitCode)})`)
  }
  return Object.freeze({
    textures,
    renderFrames,
    audioFrames,
  })
}
