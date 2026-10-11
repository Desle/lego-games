import type { DriverPreview } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltDriverScene } from '@lego-games/lego-racers/racer-appearance'
import type { Scene as ThreeScene } from 'three'
import { createModelObject } from '../model-object/model-object.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import type { DriverView } from './driver-view.types.ts'

// The driver the editor shows on its platform: the figure builder's model of the five part bytes (the one the race draws),
// built again when a part changes and standing at the point the platform's camera looks at.
export const createDriverView = (archive: JamArchive, scene: ThreeScene): DriverView => {
  const slot = createModelSlot(scene)
  return Object.freeze({
    show: (preview: DriverPreview, position: readonly [number, number, number]) => {
      const model = slot.show(preview.partBytes.join(':'), () =>
        createModelObject(loadBuiltDriverScene(archive, preview.partBytes))
      )
      model.group.position.set(...position)
      model.group.updateMatrix()
    },
    dispose: slot.dispose,
  })
}
