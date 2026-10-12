import type { BuilderPreview } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadBuiltCarScene } from '@lego-games/lego-racers/racer-appearance'
import type { Scene as ThreeScene } from 'three'
import { getCarDesignKey } from '../car-design-key/car-design-key.ts'
import { createModelObject } from '../model-object/model-object.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import type { BuilderCarView } from './builder-car-view.types.ts'

// The car of the builder screen in the garage world: the mesh builder's model of the placed bricks and the brick in the
// cursor (FrontEnd_BuildBuiltCarSlot 0x0042dcb0 builds the race car the same way), replaced when the design changes.
export const createBuilderCarView = (archive: JamArchive, scene: ThreeScene): BuilderCarView => {
  const slot = createModelSlot(scene)
  return Object.freeze({
    show: (preview: BuilderPreview) =>
      slot.show(getCarDesignKey(preview.design), () =>
        createModelObject(loadBuiltCarScene(archive, preview.design))
      ),
    dispose: slot.dispose,
  })
}
