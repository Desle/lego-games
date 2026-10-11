import type { Scene as ThreeScene } from 'three'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { ModelSlot } from './model-slot.types.ts'

// A model in a scene that is built again only when its key changes: the builder's car and the driver editor's driver are
// each one, replaced as the player edits.
export const createModelSlot = (scene: ThreeScene): ModelSlot => {
  let shownKey: string | null = null
  let shown: ModelObject | null = null
  const hide = () => {
    if (shown === null) return
    scene.remove(shown.group)
    shown.object.dispose()
    shown = null
  }
  return Object.freeze({
    show: (key: string, create: () => ModelObject): ModelObject => {
      if (key === shownKey && shown !== null) return shown
      hide()
      shownKey = key
      shown = create()
      scene.add(shown.group)
      return shown
    },
    dispose: () => {
      hide()
      shownKey = null
    },
  })
}
