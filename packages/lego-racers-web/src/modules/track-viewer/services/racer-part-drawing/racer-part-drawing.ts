import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Group } from 'three'
import { getRacerPartDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { RacerPartKind } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { RacerPartIdentity } from './racer-part-drawing.types.ts'

// A racer's wheels or driver, in place of the original's mesh when a viewer extension has a drawing for it: the original's mesh is
// hidden, the drawing takes the model's scale and the model's group moves it, and the poses the viewer gives the original's
// skeleton (an animation state, or whole milliseconds of its own clock) reach the drawing too. The model itself otherwise.
export const showRacerPartDrawing = (
  model: ModelObject,
  scene: ModelScene,
  archive: JamArchive,
  kind: RacerPartKind,
  identity: RacerPartIdentity
): ModelObject => {
  const drawing = getRacerPartDrawing({ kind, archive, model: scene, ...identity })
  if (drawing === null) return model
  const { group, object } = model
  object.group.visible = false
  const scaled = new Group()
  scaled.scale.setScalar(scene.meshScales[0] ?? 1)
  scaled.add(drawing.object)
  group.add(scaled)
  return {
    group,
    object: {
      ...object,
      setAnimationState: (state) => {
        object.setAnimationState(state)
        drawing.setAnimationState(state)
      },
      animate: (deltaMilliseconds) => {
        object.animate(deltaMilliseconds)
        drawing.animate(deltaMilliseconds)
      },
      dispose: () => {
        object.dispose()
        drawing.dispose()
      },
    },
  }
}
