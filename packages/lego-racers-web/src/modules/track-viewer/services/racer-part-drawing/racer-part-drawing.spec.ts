import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Group } from 'three'
import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { RacerPartKind } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import { showRacerPartDrawing } from './racer-part-drawing.ts'

const MODEL_SCALE = 0.25
const identity = { modelName: 'dajmw', partBytes: null }
const scene = {
  scene: {},
  meshScales: [MODEL_SCALE],
} as unknown as ModelScene

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

const createDrawing = () => ({
  object: new Group(),
  setAnimationState: vi.fn(),
  animate: vi.fn(),
  dispose: vi.fn(),
})

describe('showRacerPartDrawing', () => {
  afterEach(() => clearViewerExtensions())

  it('keeps the original model when no extension has a drawing', () => {
    // Arrange
    const { model } = createModel()
    registerViewerExtension(NEUTRAL_EXTENSION)

    // Act
    const shown = showRacerPartDrawing(
      model,
      scene,
      {} as JamArchive,
      RacerPartKind.WHEELS,
      identity
    )

    // Assert
    expect([shown, model.object.group.visible, model.group.children.length]).toEqual([
      model,
      true,
      0,
    ])
  })

  it('hides the original and puts the drawing at the model scale in the model group', () => {
    // Arrange
    const { model } = createModel()
    const drawing = createDrawing()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getRacerPartDrawing: () => drawing })

    // Act
    const shown = showRacerPartDrawing(
      model,
      scene,
      {} as JamArchive,
      RacerPartKind.DRIVER,
      identity
    )

    // Assert
    const [scaled] = model.group.children
    expect([shown.group, model.object.group.visible, scaled?.scale.x, scaled?.children[0]]).toEqual(
      [model.group, false, MODEL_SCALE, drawing.object]
    )
  })

  it('passes the poses the viewer gives the original to the drawing, and disposes both', () => {
    // Arrange
    const { model, object } = createModel()
    const drawing = createDrawing()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getRacerPartDrawing: () => drawing })
    const shown = showRacerPartDrawing(
      model,
      scene,
      {} as JamArchive,
      RacerPartKind.WHEELS,
      identity
    )
    const state = {} as Parameters<SceneObject['setAnimationState']>[0]

    // Act
    shown.object.setAnimationState(state)
    shown.object.animate(16)
    shown.object.dispose()

    // Assert
    expect([
      vi.mocked(object.setAnimationState).mock.calls,
      drawing.setAnimationState.mock.calls,
      vi.mocked(object.animate).mock.calls,
      drawing.animate.mock.calls,
      vi.mocked(object.dispose).mock.calls.length,
      drawing.dispose.mock.calls.length,
    ]).toEqual([[[state]], [[state]], [[16]], [[16]], 1, 1])
  })
})
