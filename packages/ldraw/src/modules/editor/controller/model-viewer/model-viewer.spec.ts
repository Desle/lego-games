// @vitest-environment jsdom
import { setUpModelParser } from '../../../geometry/index.ts'
import { LDrawDetail } from '../../../library/index.ts'
import { LookPreset, setActiveLookPreset } from '../../../material/index.ts'
import { Group } from 'three'
import { createModelObject } from '../../services/model-object/model-object.ts'
import type { HeldModelObject } from '../../services/model-object/model-object.types.ts'
import { createModelStage } from '../../services/model-stage/model-stage.ts'
import type { ModelStage } from '../../services/model-stage/model-stage.types.ts'
import { createModelViewer, formatStats } from './model-viewer.ts'

vi.mock('../../../geometry/index.ts', () => ({ setUpModelParser: vi.fn() }))
vi.mock('../../../material/index.ts', async (importOriginal) => ({
  ...(await importOriginal<Readonly<Record<string, unknown>>>()),
  setActiveLookPreset: vi.fn(),
}))
vi.mock('../../services/model-object/model-object.ts', () => ({ createModelObject: vi.fn() }))
vi.mock('../../services/model-stage/model-stage.ts', () => ({ createModelStage: vi.fn() }))

const LIBRARY_URL = '/files/ldraw'
const FIRST_MODEL = '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat'
const SECOND_MODEL = '1 1 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat'

const createStage = (): ModelStage => ({
  setModel: vi.fn(),
  draw: vi.fn(() => ({ drawCalls: 12, triangles: 34_567 })),
  dispose: vi.fn(),
})

const createHeld = (): HeldModelObject => ({ object: new Group(), release: vi.fn() })

const createDeferred = () => {
  let resolve: (held: HeldModelObject) => void = () => undefined
  const promise = new Promise<HeldModelObject>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

let frames: FrameRequestCallback[] = []
let stage = createStage()

beforeEach(() => {
  vi.clearAllMocks()
  frames = []
  stage = createStage()
  vi.mocked(createModelStage).mockReturnValue(stage)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createModelViewer', () => {
  it('puts a canvas and a stats readout in the element and sets up the parser with the library URL', () => {
    // Arrange
    const element = document.createElement('div')

    // Act
    createModelViewer(element, { libraryUrl: LIBRARY_URL })

    // Assert
    expect(element.querySelector('canvas')).not.toBeNull()
    expect(element.textContent).toBe('0 draw calls · 0 triangles')
    expect(vi.mocked(setUpModelParser).mock.calls[0]?.[0]).toMatchObject({
      libraryUrl: LIBRARY_URL,
      splitSubModels: null,
    })
  })

  it('shows a model framed at high detail, and lets go of it when the next one is shown', async () => {
    // Arrange
    const first = createHeld()
    const second = createHeld()
    vi.mocked(createModelObject).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const viewer = createModelViewer(document.createElement('div'), { libraryUrl: LIBRARY_URL })

    // Act
    await viewer.showModel(FIRST_MODEL)
    await viewer.showModel(SECOND_MODEL)

    // Assert
    expect(vi.mocked(createModelObject).mock.calls).toEqual([
      [FIRST_MODEL, LDrawDetail.HIGH],
      [SECOND_MODEL, LDrawDetail.HIGH],
    ])
    expect(stage.setModel).toHaveBeenLastCalledWith(second.object, true)
    expect(first.release).toHaveBeenCalledOnce()
    expect(second.release).not.toHaveBeenCalled()
  })

  it('drops a model that finishes loading after a later one', async () => {
    // Arrange
    const slow = createDeferred()
    const stale = createHeld()
    const latest = createHeld()
    vi.mocked(createModelObject).mockReturnValueOnce(slow.promise).mockResolvedValueOnce(latest)
    const viewer = createModelViewer(document.createElement('div'), { libraryUrl: LIBRARY_URL })

    // Act
    const staleShow = viewer.showModel(FIRST_MODEL)
    await viewer.showModel(SECOND_MODEL)
    slow.resolve(stale)
    await staleShow

    // Assert
    expect(stage.setModel).toHaveBeenCalledOnce()
    expect(stage.setModel).toHaveBeenCalledWith(latest.object, true)
    expect(stale.release).toHaveBeenCalledOnce()
  })

  it('keeps the camera when the caller asks to', async () => {
    // Arrange
    const held = createHeld()
    vi.mocked(createModelObject).mockResolvedValueOnce(held)
    const viewer = createModelViewer(document.createElement('div'), { libraryUrl: LIBRARY_URL })

    // Act
    await viewer.showModel(FIRST_MODEL, { isCameraKept: true })

    // Assert
    expect(stage.setModel).toHaveBeenCalledWith(held.object, false)
  })

  it('switches the look and shows the same model again in place', async () => {
    // Arrange
    vi.mocked(createModelObject).mockResolvedValue(createHeld())
    const viewer = createModelViewer(document.createElement('div'), { libraryUrl: LIBRARY_URL })
    await viewer.showModel(FIRST_MODEL)

    // Act
    await viewer.setLook(LookPreset.PHOTO)

    // Assert
    expect(setActiveLookPreset).toHaveBeenCalledWith(LookPreset.PHOTO)
    expect(vi.mocked(createModelObject).mock.calls[1]).toEqual([FIRST_MODEL, LDrawDetail.HIGH])
    expect(stage.setModel).toHaveBeenLastCalledWith(expect.any(Group), false)
  })

  it('switches the detail and shows the same model again at it', async () => {
    // Arrange
    vi.mocked(createModelObject).mockResolvedValue(createHeld())
    const viewer = createModelViewer(document.createElement('div'), { libraryUrl: LIBRARY_URL })
    await viewer.showModel(FIRST_MODEL)

    // Act
    await viewer.setDetail(LDrawDetail.LOW)

    // Assert
    expect(vi.mocked(createModelObject).mock.calls[1]).toEqual([FIRST_MODEL, LDrawDetail.LOW])
  })

  it('reads out what the last frame drew', () => {
    // Arrange
    const element = document.createElement('div')
    const viewer = createModelViewer(element, { libraryUrl: LIBRARY_URL })

    // Act
    for (const frame of frames.splice(0)) frame(0)

    // Assert
    expect(viewer.getStats()).toEqual({ drawCalls: 12, triangles: 34_567 })
    expect(element.textContent).toBe('12 draw calls · 34,567 triangles')
  })

  it('takes itself out of the element and lets go of its model when disposed', async () => {
    // Arrange
    const held = createHeld()
    vi.mocked(createModelObject).mockResolvedValueOnce(held)
    const element = document.createElement('div')
    const viewer = createModelViewer(element, { libraryUrl: LIBRARY_URL })
    await viewer.showModel(FIRST_MODEL)

    // Act
    viewer.dispose()

    // Assert
    expect(element.childElementCount).toBe(0)
    expect(held.release).toHaveBeenCalledOnce()
    expect(stage.dispose).toHaveBeenCalledOnce()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})

describe('formatStats', () => {
  it('writes the draw calls and triangles with thousands separators', () => {
    // Arrange
    const stats = { drawCalls: 1_204, triangles: 2_500_000 }

    // Act
    const text = formatStats(stats)

    // Assert
    expect(text).toBe('1,204 draw calls · 2,500,000 triangles')
  })
})
