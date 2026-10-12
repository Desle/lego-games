import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Group } from 'three'
import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type {
  CarDrawingPose,
  CarDrawingRequest,
  DriverDrawingPose,
  DriverDrawingRequest,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import { attachCarDrawing, showCarDrawing, showDriverDrawing } from './racer-drawing.ts'

const part = { model: {} as ModelScene, modelName: 'dajmw', partBytes: null }
const carRequest: CarDrawingRequest = {
  archive: {} as JamArchive,
  carCode: 'RRCM',
  design: null,
  wheels: part,
}
const driverRequest: DriverDrawingRequest = { archive: {} as JamArchive, driver: part }

const createModel = () => {
  const object = {
    group: new Group(),
    setAnimationState: vi.fn(),
    animate: vi.fn(),
    dispose: vi.fn(),
  } as unknown as SceneObject
  const model: ModelObject = { group: new Group(), object }
  return { model, object }
}

const createCarDrawing = () => ({
  object: new Group(),
  applyPose: vi.fn<(pose: CarDrawingPose) => void>(),
  dispose: vi.fn(),
  onFailed: vi.fn<(listener: () => void) => void>(),
})

const createDriverDrawing = () => ({
  object: new Group(),
  applyPose: vi.fn<(pose: DriverDrawingPose) => void>(),
  animate: vi.fn(),
  dispose: vi.fn(),
})

describe('racer drawings', () => {
  afterEach(() => clearViewerExtensions())

  it('keeps the original model when no extension has a drawing', () => {
    // Arrange
    const { model } = createModel()
    registerViewerExtension(NEUTRAL_EXTENSION)

    // Act
    const shown = [showCarDrawing(model, carRequest), showDriverDrawing(model, driverRequest)]

    // Assert
    expect([shown, model.object.group.visible, model.group.children.length]).toEqual([
      [model, model],
      true,
      0,
    ])
  })

  it('hides the original car and rests the drawing in the model group', () => {
    // Arrange
    const { model } = createModel()
    const drawing = createCarDrawing()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getCarDrawing: () => drawing })

    // Act
    showCarDrawing(model, carRequest)

    // Assert
    const [pose] = drawing.applyPose.mock.calls[0] ?? []
    expect([
      model.object.group.visible,
      model.group.children,
      pose?.body?.isVisible,
      pose?.opacity,
    ]).toEqual([false, [drawing.object], true, 1])
  })

  it('gives a figure the animation states and the clock of the original', () => {
    // Arrange
    const { model, object } = createModel()
    const drawing = createDriverDrawing()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getDriverDrawing: () => drawing })
    const shown = showDriverDrawing(model, driverRequest)
    const state = {} as Parameters<SceneObject['setAnimationState']>[0]

    // Act
    shown.object.setAnimationState(state)
    shown.object.animate(16)
    shown.object.dispose()

    // Assert
    expect([
      drawing.applyPose.mock.calls.at(-1)?.[0].animationState,
      drawing.animate.mock.calls,
      object.dispose,
      drawing.dispose,
    ]).toEqual([state, [[16]], expect.anything(), expect.anything()])
    expect([
      vi.mocked(object.dispose).mock.calls.length,
      drawing.dispose.mock.calls.length,
    ]).toEqual([1, 1])
  })

  it('follows the parts of a car the viewer moves every frame and disposes with the wheels', () => {
    // Arrange
    const wheels = createModel()
    const body = createModel()
    wheels.model.group.matrix.makeTranslation(1, 2, 3)
    body.model.group.visible = false
    const drawing = createCarDrawing()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getCarDrawing: () => drawing })
    const host = new Group()

    // Act
    const link = attachCarDrawing({ wheels: wheels.model, body: body.model }, carRequest, host)
    link?.sync(0.5)
    link?.wheels.object.dispose()

    // Assert
    const [pose] = drawing.applyPose.mock.calls[0] ?? []
    expect([
      pose?.wheels.matrix.elements.slice(12, 15),
      pose?.body?.isVisible,
      pose?.opacity,
      wheels.model.object.group.visible,
      host.children.length,
      drawing.dispose.mock.calls.length,
    ]).toEqual([[1, 2, 3], false, 0.5, false, 0, 1])
  })

  it('shows the original car again when the drawing fails to build', () => {
    // Arrange
    const { model } = createModel()
    const drawing = createCarDrawing()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getCarDrawing: () => drawing })
    showCarDrawing(model, carRequest)
    const [listener] = drawing.onFailed.mock.calls[0] ?? []

    // Act
    listener?.()

    // Assert
    expect([model.object.group.visible, model.group.children.length]).toEqual([true, 0])
  })

  it('shows the original parts again when the drawing of a car in a race fails to build', () => {
    // Arrange
    const wheels = createModel()
    const drawing = createCarDrawing()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getCarDrawing: () => drawing })
    const host = new Group()
    attachCarDrawing({ wheels: wheels.model, body: null }, carRequest, host)
    const [listener] = drawing.onFailed.mock.calls[0] ?? []

    // Act
    listener?.()

    // Assert
    expect([wheels.model.object.group.visible, host.children.length]).toEqual([true, 0])
  })
})
