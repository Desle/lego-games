import { setUpModelParser } from '../../../geometry/index.ts'
import { LDrawDetail } from '../../../library/index.ts'
import { setActiveLookPreset } from '../../../material/index.ts'
import type { LookPreset } from '../../../material/index.ts'
import { createModelObject } from '../../services/model-object/model-object.ts'
import type { HeldModelObject } from '../../services/model-object/model-object.types.ts'
import { createModelStage } from '../../services/model-stage/model-stage.ts'
import type { ModelViewerStats, ShowModelOptions } from '../../types/model-viewer.types.ts'
import type { ModelViewer, ModelViewerOptions } from './model-viewer.types.ts'

const NO_STATS: ModelViewerStats = Object.freeze({ drawCalls: 0, triangles: 0 })

export const formatStats = (stats: ModelViewerStats): string =>
  `${stats.drawCalls.toLocaleString('en-US')} draw calls · ${stats.triangles.toLocaleString('en-US')} triangles`

const createParseWorker = (): Worker =>
  new Worker(new URL('../../services/model-parse-worker/model-parse.worker.ts', import.meta.url), {
    type: 'module',
  })

const createViewerElements = (element: HTMLElement) => {
  const container = document.createElement('div')
  container.style.cssText = 'position: relative; width: 100%; height: 100%; overflow: hidden'
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display: block; width: 100%; height: 100%; touch-action: none'
  const readout = document.createElement('div')
  readout.style.cssText =
    'position: absolute; right: 8px; bottom: 8px; padding: 4px 8px; pointer-events: none; ' +
    'background: rgba(20, 25, 33, 0.85); color: #e8ecf2; font: 12px ui-monospace, monospace'
  readout.textContent = formatStats(NO_STATS)
  container.append(canvas, readout)
  element.append(container)
  return { container, canvas, readout }
}

// A viewer for one LDraw model in `element`: the caller passes the model's text (the viewer reads no files) and the URL it serves the
// parts library at. The parser and the look are the page's: the first caller's parser settings stay, and a look set here is every
// drawing's.
export const createModelViewer = (
  element: HTMLElement,
  options: ModelViewerOptions
): ModelViewer => {
  setUpModelParser({
    libraryUrl: options.libraryUrl,
    createWorker: createParseWorker,
    splitSubModels: null,
    addLoadMilliseconds: () => undefined,
    measureWork: (_label, work) => work(),
  })
  if (options.look !== undefined) setActiveLookPreset(options.look)
  const { container, canvas, readout } = createViewerElements(element)
  const stage = createModelStage(canvas)
  let detail = options.detail ?? LDrawDetail.HIGH
  let shownText: string | null = null
  let shown: HeldModelObject | null = null
  let stats = NO_STATS
  let loadCounter = 0
  let isDisposed = false

  const loadModel = async (text: string, isCameraKept: boolean) => {
    loadCounter += 1
    const counter = loadCounter
    const loaded = await createModelObject(text, detail)
    if (counter !== loadCounter || isDisposed) {
      loaded.release()
      return
    }
    shown?.release()
    shown = loaded
    stage.setModel(loaded.object, !isCameraKept)
  }

  const showModel = (text: string, showOptions?: ShowModelOptions): Promise<void> => {
    shownText = text
    return loadModel(text, showOptions?.isCameraKept ?? false)
  }

  const showAgain = (): Promise<void> =>
    shownText === null ? Promise.resolve() : loadModel(shownText, true)

  const setLook = (preset: LookPreset): Promise<void> => {
    setActiveLookPreset(preset)
    return showAgain()
  }

  const setDetail = (next: LDrawDetail): Promise<void> => {
    detail = next
    return showAgain()
  }

  let frame = 0
  const draw = () => {
    const next = stage.draw()
    if (next.drawCalls !== stats.drawCalls || next.triangles !== stats.triangles) {
      stats = next
      readout.textContent = formatStats(stats)
    }
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)

  const dispose = () => {
    if (isDisposed) return
    isDisposed = true
    cancelAnimationFrame(frame)
    shown?.release()
    shown = null
    stage.dispose()
    container.remove()
  }

  return Object.freeze({ showModel, setLook, setDetail, getStats: () => stats, dispose })
}
