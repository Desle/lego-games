import type { BuilderPreview } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltCarScene } from '@lego-games/lego-racers/racer-appearance'
import type { Scene as ThreeScene } from 'three'
import { createModelObject } from '../model-object/model-object.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { BuilderCarView } from './builder-car-view.types.ts'

// One number per brick (piece, place, turn, colour and height) names a design; the car is built again when it changes.
const getDesignKey = (preview: BuilderPreview): string =>
  preview.design.bricks
    .map((brick) =>
      [
        brick.piece.id,
        brick.x,
        brick.y,
        brick.orientation,
        brick.colorIndex,
        brick.baseHeight,
      ].join(':')
    )
    .join('|')

// The car of the builder screen in the garage world: the mesh builder's model of the placed bricks and the brick in the
// cursor (FrontEnd_BuildBuiltCarSlot 0x0042dcb0 builds the race car the same way), replaced when the design changes.
export const createBuilderCarView = (archive: JamArchive, scene: ThreeScene): BuilderCarView => {
  let shownKey: string | null = null
  let shown: ModelObject | null = null
  const hide = () => {
    if (shown === null) return
    scene.remove(shown.group)
    shown.object.dispose()
    shown = null
  }
  return Object.freeze({
    show: (preview: BuilderPreview) => {
      const key = getDesignKey(preview)
      if (key === shownKey) return
      hide()
      shownKey = key
      shown = createModelObject(loadBuiltCarScene(archive, preview.design))
      scene.add(shown.group)
    },
    dispose: () => {
      hide()
      shownKey = null
    },
  })
}
